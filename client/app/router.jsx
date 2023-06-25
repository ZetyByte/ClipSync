"use client"

export default function UrlID(){
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    console.log(id);
    return id;
}