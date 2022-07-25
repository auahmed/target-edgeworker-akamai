
import { Cookies, SetCookie } from "cookies";
import { logger } from "log";

import {
  deliveryApiCall
} from "./target";

const mboxCookieName = "mbox"; // Name of cookie that stores user identifier (visitorId) assignment
const mboxEdgeClusterCookieName = "mboxEdgeCluster";
const tntMaxAge = 63244801; // 2 years
const sessionMaxAge = 1860; // 30 minutes
const sessionIdVariable = "PMUSER_TARGET_SESSION_ID";
const tntIdVariable = "PMUSER_TARGET_TNT_ID";
const mboxesListVariable = "PMUSER_TARGET_MBOXES_LIST";
const key_value_delimiter = ",";

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
  // TODO: Create into an array of objects with featureKey, variationKey and experimentKey
  return [[], []];
}

/**
 * Trims all empty spaces from strings in the string array in case of human error.
 * When splitting a comma delimited string any spaces around the flagKeys will cause issues when retrieving decisions
 *
 * @param {*} arr
 * @returns
 */
function trimArray(arr) {
  let i;
  for (i = 0; i < arr.length; i++) {
    arr[i] = arr[i].replace(/^\s\s*/, "").replace(/\s\s*$/, "");
  }
  return arr;
}

// Returns an array list of mboxes requiring a decision
function getMboxesFromString(value) {
  if (!value) return [];

  let result = value.split(key_value_delimiter);
  result = trimArray(result);

  return result;
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
  let mboxesToDecide; // contains a list of all mboxes that require a decision
  let reasons; // An array of relevant error and log messages, in chronological order

  let sessionId;
  let tntId;

  try {
    //   Create query parames object
    let params = new URLSearchParams(request.query);

    // get all mboxes to query
    const mboxes_param = params.get(MBOXES_PARAM);
    // TODO: if no params found

    let cookies = new Cookies(request.getHeader("Cookie") || "");
    [sessionId, tntId] = getSessionAndTntFromCookie(cookies, request);

    if (!!mboxes_param) {
      mboxesToDecide = getMboxesFromString(mboxes_param);
      request.setVariable(mboxesListVariable, (mboxesToDecide || "").join());

      [allDecisions, reasons] = await getDecisionsForRequest(
        request,
        sessionId,
        tntId,
        mboxesToDecide
      );
    }

    return [allDecisions, reasons];
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
  let [decisions, reasons] = await getRequestTargetDecisions(request);
  // Do something with the decisions here...
  /******************** Your code starts here *******************/

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
