# Legion
The legion overlay and messaging code base.
Version 0.1.0

### Installation
You need node (npm) [https://nodejs.org/en/].
```sh
$ git clone https://github.com/albertlinde/Legion
$ cd Legion
$ npm install
```

### Running
```sh
$ npm start
```
**Start** starts both HTTP and Signalling server. Open localhost:8000 in your Google Chrome browser.
```sh
$ npm stop
```
**Stop** shuts down the HTTP and Signalling servers.
Logs can be found in the folder **run**.

### Development
Open localhost:8000/indexDebug.html in your browser to obtain per file error handling.

 - /applications contains the example application.
 - /framework contains legion.
 - /framework/client/protocols have basic overlay and messaging protocols.

```sh
./compile.sh    #updates legion-min.js
```

---

#### License
Apache-2.0
