import { httpRequest } from "http-request";
import { logger } from "log";

const HOSTNAME = "";
const CLIENT = "";

async function deliveryApiCall(
  sessionId,
  tntId,
  mboxesToDecide
) {
  try {
    const url = `${HOSTNAME}/rest/v1/delivery?client=${CLIENT}&sessionId=${sessionId}`;

    const mboxes = [];
    let i;
    for (i = 0; i < mboxesToDecide.length; i++) {
      mboxes.push({
        index: i,
        name: mboxesToDecide[i]
      })
    };

    const body = {
      context: {
        channel: "web"
      },
      experienceCloud: {
        analytics: {
          logging: "client_side"
        }
      },
      id: {
        tntId: tntId
      },
      execute: {
        mboxes
      }
    };

    const response = await httpRequest(`${url}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    let jsonResponse = {};
    if (response.ok) {
      jsonResponse = await response.json();
    } else {
      const responseError = await response.text();
      logger.log(
        "Receieved error from Delivery API call: %s",
        responseError
      );
    }

    return jsonResponse;
  } catch (err) {
    logger.log(
      "Failed to complete Delivery API call: %s",
      err.message
    );
  }
}

export {
  deliveryApiCall
};
