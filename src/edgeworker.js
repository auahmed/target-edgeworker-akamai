import { Cookies, SetCookie } from "cookies";
import { logger } from "log";

import {
  deliveryApiCall
} from "./target";
import mboxesList from './mboxes'

const mboxCookieName = "mbox"; // Name of cookie that stores user identifier (visitorId) assignment
const mboxEdgeClusterCookieName = "mboxEdgeCluster";
const tntMaxAge = 63244801; // 2 years
const sessionMaxAge = 1860; // 30 minutes
const sessionIdVariable = "PMUSER_TARGET_SESSION_ID";
const tntIdVariable = "PMUSER_TARGET_TNT_ID";
const mboxesListVariable = "PMUSER_TARGET_MBOXES_LIST";
const tntaListVariable = "PMUSER_TNTA_LIST";

// CDN Agent functionality
const MBOXES_PARAM = "mboxes";

async function getDecisionsForRequest(
  request,
  sessionId,
  tntId,
  mboxesToDecide
) {
  const targetResponse = await deliveryApiCall(
    sessionId,
    tntId,
    mboxesToDecide
  );
  // Save sessionId and tntId returned from target
  request.setVariable(sessionIdVariable, sessionId);
  request.setVariable(tntIdVariable, targetResponse.id.tntId);

  const decisions = [];
  for (let i = 0; i < targetResponse.execute.mboxes.length; i++) {
    const mbox = targetResponse.execute.mboxes[i];
    if (mbox.options && mbox.options.length > 0) {
      decisions.push({
        mbox: mbox.name,
        content: mbox.options[0].content,
        tnta: mbox.metrics[0].analytics.payload.tnta
      })
    }
  }
  return decisions;
}

// Generate a unique id for session and tnt ids
function createID() {
  var dt = new Date().getTime();
  var uuid = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (dt + Math.random() * 16) % 16 | 0;
    dt = Math.floor(dt / 16);
    return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
  return uuid;
}

// check if mbox cookie exist and if so get ids otherwise generate new ids
function getSessionAndTntFromCookie(cookies, request) {
  let tntId;
  let sessionId;

  try {
    let mboxCookie = cookies.get(mboxCookieName);

    if (mboxCookie) {
      // mbox cookie found leading us to know visitor
      mboxCookie.split("|").forEach(function (element) {
        if (element.startsWith("PC#")) {
          tntId = element.split("#")[1];
        } else if (element.startsWith("session#")) {
          sessionId = element.split("#")[1];
          const expiry = element.split("#")[2];
          const date = new Date();
          const dateSeconds = Math.floor(date.getTime() / 1000);
          if (expiry - dateSeconds < 0) {
            sessionId = createID();
          }
        }
      })
    } else {
      // mbox cookie not found so need to create new visitor
      sessionId = createID();
      tntId = sessionId;
    }

  } catch (err) {
    logger.log("Error getSessionAndTntFromCookie: %s", err.message);
  }

  return [sessionId, tntId]
}

async function getRequestTargetDecisions(request) {
  let allDecisions = []; // concatenated array that will contain all decisions

  let sessionId;
  let tntId;

  try {
    let cookies = new Cookies(request.getHeader("Cookie") || "");
    [sessionId, tntId] = getSessionAndTntFromCookie(cookies, request);

    const mboxes = mboxesList[request.path]

    if (!mboxes.length) {
      const mboxes = mboxesList[request.path]
      request.setVariable(mboxesListVariable, (mboxes || "").join());

      allDecisions = await getDecisionsForRequest(
        request,
        sessionId,
        tntId,
        mboxes
      );
    }

    return allDecisions;
  } catch (err) {
    logger.log(
      "Failed to complete processing operations within onClientRequest: %s",
      err.message
    );
  }
}

async function onClientRequest(request) {
  // Get decisions for the current visitor and set the origin headers with all valid decisions
  // The decisions object will contain an array of objects with featureKey, variationKey and experimentKey
  let decisions = await getRequestTargetDecisions(request);
  // Do something with the decisions here...
  /******************** Your code starts here *******************/
  // TODO: confirm with akamai if we can use headers for caching or if it has to be query params:
  // https://techdocs.akamai.com/download-delivery/docs/cache-key-query-parameters-and-dd
  request.setHeader('personalization-decisions', JSON.stringify(decisions));
  /******************** Your code ends here ********************/
}

/**
 * Builds cookies to be sent back to the user
 * @param {*} request 
 * @param {*} response 
 */
function createCookies(request, response) {
  // TODO: SDID or tntaid for analytics
  let sessionId = request.getVariable(sessionIdVariable);
  let tntId = request.getVariable(tntIdVariable);

  const date = new Date();
  const dateSeconds = Math.floor(date.getTime() / 1000);
  const mboxExpiry = dateSeconds + sessionMaxAge;
  const tntExpiry = dateSeconds + tntMaxAge;

  const mboxCookieValue = `session#${sessionId}#${mboxExpiry}|PC#${tntId}#${tntExpiry}`;

  let setMboxCookie = new SetCookie({
    name: mboxCookieName,
    value: mboxCookieValue,
    maxAge: tntMaxAge,
  });
  response.addHeader("Set-Cookie", setMboxCookie.toHeader());

  let setMboxEdgeClusterCookie = new SetCookie({
    name: mboxEdgeClusterCookieName,
    value: tntId.split(".")[1].split("_")[0],
    maxAge: sessionMaxAge,
  });
  response.addHeader("Set-Cookie", setMboxEdgeClusterCookie.toHeader());

  return;
}

async function onClientResponse(request, response) {
  try {
    // Returns the HTTP response status code and the cookies
    createCookies(
      request,
      response
    );
    /******************** Your code starts here *******************/

    /******************** Your code ends here ********************/
  } catch (err) {
    // Catch any errors and return the appropriate response
    logger.log("Error in onClientResponse: %s", err.message);
    //return request.respondWith(500, {}, err.message);
  }
}

export default {
  onClientRequest,
  onClientResponse
}
