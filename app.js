function fetchJsonp(_url, options = {}) {

  const defaultOptions = {
    timeout: 5000,
    jsonpCallback: 'callback',
    jsonpCallbackFunction: null
  };

  function generateCallbackFunction() {
    return `jsonp_${Date.now()}_${Math.ceil(Math.random() * 100000)}`;
  }

  function removeScript(scriptId) {
    const script = document.getElementById(scriptId);
    if (script) {
      document.getElementsByTagName('head')[0].removeChild(script);
    }
  }

  // to avoid param reassign
  let url = _url;
  const timeout = options.timeout || defaultOptions.timeout;
  const jsonpCallback = options.jsonpCallback || defaultOptions.jsonpCallback;

  let timeoutId;

  return new Promise((resolve, reject) => {
    const callbackFunction = options.jsonpCallbackFunction || generateCallbackFunction();
    const scriptId = `${jsonpCallback}_${callbackFunction}`;

    window[callbackFunction] = (response) => {
      resolve({
        ok: true,
        // keep consistent with fetch API
        json: () => Promise.resolve(response),
      });

      if (timeoutId) clearTimeout(timeoutId);

      removeScript(scriptId);
    };

    // Check if the user set their own params, and if not add a ? to start a list of params
    url += (url.indexOf('?') === -1) ? '?' : '&';

    const jsonpScript = document.createElement('script');
    jsonpScript.setAttribute('src', `${url}${jsonpCallback}=${callbackFunction}`);
    if (options.charset) {
      jsonpScript.setAttribute('charset', options.charset);
    }
    jsonpScript.id = scriptId;
    document.getElementsByTagName('head')[0].appendChild(jsonpScript);

    timeoutId = setTimeout(() => {
      reject(new Error(`JSONP request to ${_url} timed out`));

      removeScript(scriptId);
    }, timeout);

    // Caught if got 404/500
    jsonpScript.onerror = () => {
      reject(new Error(`JSONP request to ${_url} failed`));

      removeScript(scriptId);
      if (timeoutId) clearTimeout(timeoutId);
    };
  });
}

/* end of fetchJsonp */

const twitchStreams =
  (function IIFE(document) {

    const baseUrl = "https://wind-bow.gomix.me/twitch-api";

    const channelList = ["ESL_SC2", "FreeCodeCamp","OgamingSC2","RobotCaleb", "cretetion","noopkat", "noobs2ninjas"];

    function getChannelData(name) {
      const endpoint = `${baseUrl}/channels/${name}`;

      return new Promise((resolve, reject) => {

        const data = {
          name: name,
          status: "Not Found"
        };

        fetchJsonp(endpoint).then(blob => blob.json())
          .then(channelData => {
            data.channel = channelData;
            //only execute stream call if channel found
            if (!channelData.error) {
              return getStreamData(name);
            }
          })
          .then(streamData => {
            if (streamData) {
              data.stream = streamData.stream;
              data.status = streamData.stream ? "Streaming" : "Offline";
            }
            resolve(data);
          })
          .catch((err) => reject(new Error(err)));
      });
    }

    function getStreamData(name) {
      const endpoint = `${baseUrl}/streams/${name}`;

      return new Promise((resolve, reject) => {
        fetchJsonp(endpoint).then(blob => blob.json())
          .then(data => resolve(data))
          .catch((err) => reject(new Error(err)));
      });
    }

    function createChannelNotFoundElement(name) {

      let channelRow = document.createElement("tr");
      channelRow.className = "channel not-found";
      channelRow.innerHTML = `<td><img class="logo" src=""/></td>
                          <td><div class="name">${name}</div>
                          </td><td class="stream">&#x274C; Channel Not Found</td>`;

      return channelRow;
    }

    function createChannelOfflineElement(data) {
      let channelRow = document.createElement("tr");
      channelRow.className = "channel offline";
      channelRow.innerHTML = `<td><img class="logo" src="${data.channel.logo ? data.channel.logo : ''}"/></td>
                          <td><a class="name" href="${data.channel.url}" target="_blank" title="In CodePen: right-click -> open link in new tab" rel="noopener noreferrer">${data.name}</a>
                              ${data.channel.game ? `<div class="game"><small>${data.channel.game}</small></div>` : ''}
                          </td>
                          <td class="stream">&#x1F6AB; Offline</td>`;
      return channelRow;
    }

    function createChannelStreamingElement(data) {
      let channelRow = document.createElement("tr");
      channelRow.className = "channel streaming";
      channelRow.innerHTML = `<td><img class="logo" src="${data.channel.logo ? data.channel.logo : ''}"/></td>
                          <td><a class="name" href="${data.channel.url}" target="_blank" title="In CodePen: right-click -> open link in new tab" rel="noopener noreferrer">${data.name}</a>
                              ${data.channel.game ? `<div class="game"><small>${data.channel.game}</small></div>` : ''}
                          </td>
                          <td class="stream">&#x25B6;
                           ${data.channel.status}
                          </td>`;
      return channelRow;
    }

    function renderChannelRow(data, parentTable) {

      switch(data.status) {
        case "Streaming":
          parentTable.appendChild(createChannelStreamingElement(data));
          return;
        case "Offline":
          parentTable.appendChild(createChannelOfflineElement(data));
          return;
        default:
          parentTable.appendChild(createChannelNotFoundElement(data));
          return;
      }
    }

    function createChannelArray() {

      return channelList.reduce((promiseChain,channel) => {
        return promiseChain.then(chainResults => {
          return getChannelData(channel)
            .then(data => {
              return [...chainResults, data];
            }).catch(() => {
              //in case there is any other error, render as if not found in API
              return [...chainResults, {name: channel, channel: {error: true}}];
            });
        });
      },Promise.resolve([]));
    }

    function sortChannelArray(prev,next) {
      //if same status, sort alphabetically
      // otherwise prioritize Streaming > Offline > Not Found
      if (prev.status === next.status) {
        return prev.name.toLowerCase() < next.name.toLowerCase() ? -1 : 1;
      }
      if (prev.status === "Streaming" || prev.status === "Offline" && next.status === "Not Found") {
        return -1;
      } else {
        return 1;
      }
    }

    function addChannelRows() {
      const channelTable = document.querySelector('.channels');

      createChannelArray()
        .then(arr => {
          arr.sort(sortChannelArray);
          arr.map(channel => {
            renderChannelRow(channel,channelTable)
          });
        }).catch(() => {
          //in case of total failure provide message
          document.querySelector('.channels').innerText = "Unexpected API Failure :(";
      }).then(() => {
          //always hide loader
          document.querySelector('.loader').style.display = "none";
      });
    }

    return {
      addChannelRows : addChannelRows
    }

  })(window.document);

twitchStreams.addChannelRows();
