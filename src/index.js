import edgeworker from "./edgeworker";

export async function onClientRequest(request) {
  await edgeworker.onClientRequest(request);
}

export async function onClientResponse(request, response) {
  await edgeworker.onClientResponse(request, response);
}
