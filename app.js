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

    // const channelList = ["ESL_SC2",

    const channelList = ["ESL_SC2", "cretetion", "FreeCodeCamp", "OgamingSC2", "storbeck", "Habathcx", "RobotCaleb", "noobs2ninjas"];

    function getChannelData(name) {
      const endpoint = `${baseUrl}/channels/${name}`;

      return new Promise((resolve, reject) => {

        const data = {
          name: name
        };

        fetchJsonp(endpoint).then(blob => blob.json())
          .then(channelData => {
            data.channel = channelData;
            //only execute streams ajax if channel found
            if (!channelData.error) {
              return getStreamData(name);
            }
          })
          .then(streamData => {
            data.stream = streamData ? streamData.stream : null;
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
                          </td><td class="stream"><div class="status">Channel Not Found</div></td>`;

      return channelRow;
    }

    function createChannelOfflineElement(data) {
      let channelRow = document.createElement("tr");
      channelRow.className = "channel offline";
      channelRow.innerHTML = `<td><img class="logo" src="${data.channel.logo}"/></td>
                          <td><div class="name">${data.name}</div>
                              <small><div class="game">${data.channel.game ? data.channel.game : "n/a"}</div></small>
                          </td>
                          <td class="stream"><div class="status">Offline</div></td>`;
      return channelRow;
    }

    function createChannelStreamingElement(data) {
      let channelRow = document.createElement("tr");
      channelRow.className = "channel streaming";
      channelRow.innerHTML = `<td><img class="logo" src="${data.channel.logo}"/></td>
                          <td><div class="name">${data.name}</div>
                              <small><div class="game">${data.channel.game ? data.channel.game : "n/a"}</div></small>
                          </td>
                          <td class="stream"><div class="status">Streaming</div>
                          <small><div class="description">${data.channel.status}</div></small>
                          </td>`;
      return channelRow;
    }

    function renderChannelRow(data, parentTable) {

      let channelRow;
      if (data.channel.error) {
        channelRow = createChannelNotFoundElement(data.name);
      } else {
        channelRow = data.stream ? createChannelStreamingElement(data) : createChannelOfflineElement(data);
        channelRow.setAttribute("url", data.channel.url);
        channelRow.onclick = function () {
          window.open(data.channel.url, '_blank');
        };
      }

      parentTable.appendChild(channelRow);

    }

    function renderChannels() {

      //be sure the channels are sorted alphabetically
      channelList.sort((a, b) => a.toLowerCase() < b.toLowerCase() ? -1 : 1);

      const main = document.querySelector('main');
      const channelTable = document.createElement("table");

      //We need to make separate Ajax calls per channel
      // so render table when all are done

      return channelList.reduce((chain, channel) => {
        return chain.then(() => {
          return getChannelData(channel);
        }).then((data) => {
          renderChannelRow(data, channelTable);
        }).catch(() => {
          const data = {
            name: channel,
            channel: {error: true}
          };
          renderChannelRow(data, channelTable);
        });
      }, Promise.resolve())
        .then(() => {
          main.appendChild(channelTable);
        })
        .catch((err) => console.log(err))
    }

    return {
      renderChannels: renderChannels
    }

  })(window.document);

//load channels upon load of page
twitchStreams.renderChannels();
