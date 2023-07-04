export class Pool {
  private taskQueue: WorkerTask[];
  public workerQueue: WorkerThread[];
  private poolSize: number;

  constructor(size: number) {
    this.taskQueue = [];
    this.workerQueue = [];
    this.poolSize = size;

    this.addWorkerTask = this.addWorkerTask.bind(this);
    this.init = this.init.bind(this);
    this.freeWorkerThread = this.freeWorkerThread.bind(this);
  }

  addWorkerTask(workerTask: WorkerTask): void {
    if (this.workerQueue.length > 0) {
      const workerThread = this.workerQueue.shift();
      workerThread!.run(workerTask);
    } else {
      this.taskQueue.push(workerTask);
    }
  }

  init(): void {
    for (let i = 0; i < this.poolSize; i++) {
      const workerThread = new WorkerThread(this);
      this.workerQueue.push(workerThread);
    }
  }

  freeWorkerThread(workerThread: WorkerThread): void {
    if (this.taskQueue.length > 0) {
      const workerTask = this.taskQueue.shift();
      workerThread.run(workerTask!);
    } else {
      this.workerQueue.push(workerThread);
    }
  }
}

export class WorkerThread {
  private parentPool: Pool;
  private workerTask: WorkerTask;

  constructor(parentPool: Pool) {
    this.parentPool = parentPool;
    this.workerTask = {
      worker: null,
      callback: () => {},
      startMessage: null,
    };

    this.run = this.run.bind(this);
    this.dummyCallback = this.dummyCallback.bind(this);
  }

  run(workerTask: WorkerTask): void {
    this.workerTask = workerTask;
    if (this.workerTask.worker != null) {
      this.workerTask.worker.addEventListener('message', this.dummyCallback, false);
      this.workerTask.worker.postMessage(this.workerTask.startMessage);
    }
  }

  dummyCallback(event: MessageEvent): void {
    this.workerTask.callback(event);
    this.parentPool.freeWorkerThread(this);
  }
}

export class WorkerTask {
  worker: Worker | null;
  callback: (event: MessageEvent) => void;
  startMessage: any;

  constructor(worker: Worker, callback: (event: MessageEvent) => void, msg: any) {
    this.worker = worker;
    this.callback = callback;
    this.startMessage = msg;
  }
}
