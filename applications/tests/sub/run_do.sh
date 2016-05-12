
cd run-headless-chromium/
if [ -f ./../run1.log ]
  then
  if [ -f ./../run2.log ]
  then
  if [ -f ./../run3.log ]
  then
  if [ -f ./../run4.log ]
  then
  if [ -f ./../run5.log ]
  then
  if [ -f ./../run6.log ]
  then
  if [ -f ./../run7.log ]
  then
  if [ -f ./../run8.log ]
  then
  if [ -f ./../run9.log ]
  then
  ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run10.log
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run9.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run8.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run7.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run6.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run5.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run4.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run3.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run2.log
fi
  else
    ./run-headless-chromium.js "http://localhost:8000/applications/tests/latency_b2b.html"$1 --user-data-dir=. > ./../run1.log
fi