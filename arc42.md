# ClipSync, Architecture and API

# Disclaimer

This document describes the early architecture of ClipSync. There may be further improvements and features to the application which will be reflected in this documentation.

## 1. Introduction and Goals

ClipSync is a utility app that provides a solution to a single problem - clipboard on the web

Using this web app users can quickly and easily copy/paste from one device to another.

### 1.1 Requirements Overview

The main and most basic functionality of ClipSync is transmission of clipboard between devices.

#### Main requirements

- Clipboard session is activated with a **pairing** mechanism;
- Pairing should be easy and quick by using a **qr code** or a **token**;
- Communication should happen through a backend server;
- All transmissions must be **end-to-end encrypted** on the client side;
- Server must not record the pasted clipboards. It merely acts as a middleman;

### 1.2 Quality Goals

| No.  | Quality           | Motivation |
| :--- | ----------------- | ---------- |
| 1    | Understandability |            |
| 2    | Usability         |            |
| 3    | Testability       |            |

