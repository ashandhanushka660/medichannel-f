import http from "node:http";

const LISTEN_PORT = Number(process.env.EDGE_PORT || 3000);
const NEXT_HOST = "127.0.0.1";
const NEXT_PORT = Number(process.env.NEXT_PORT || 3001);
const BACKEND_HOST = process.env.BACKEND_HOST || "127.0.0.1";
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 8080);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function cleanHeaders(headers, preserveUpgrade = false) {
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    const lower = name.toLowerCase();
    if (preserveUpgrade) {
      if (lower === "transfer-encoding" || lower === "proxy-connection") continue;
    } else if (HOP_BY_HOP.has(lower)) {
      continue;
    }
    result[name] = value;
  }
  return result;
}

function pathnameOf(requestUrl) {
  try {
    return new URL(requestUrl, "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function goesToBackend(pathname) {
  return (
    pathname === "/ws" ||
    pathname.startsWith("/ws/") ||
    pathname === "/api/v1" ||
    pathname.startsWith("/api/v1/") ||
    pathname === "/actuator" ||
    pathname.startsWith("/actuator/")
  );
}

function targetFor(pathname) {
  if (goesToBackend(pathname)) {
    return { host: BACKEND_HOST, port: BACKEND_PORT, preserveHost: false };
  }
  return { host: NEXT_HOST, port: NEXT_PORT, preserveHost: true };
}

function proxyHttp(request, response) {
  const target = targetFor(pathnameOf(request.url || "/"));
  const headers = cleanHeaders(request.headers);
  headers.host = target.preserveHost
    ? request.headers.host || `localhost:${LISTEN_PORT}`
    : `${target.host}:${target.port}`;

  const upstream = http.request(
    {
      host: target.host,
      port: target.port,
      method: request.method,
      path: request.url,
      headers,
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode || 502,
        cleanHeaders(upstreamResponse.headers)
      );
      upstreamResponse.pipe(response);
    }
  );

  upstream.on("error", (error) => {
    console.error("Edge proxy upstream error:", error.message);
    if (!response.headersSent) {
      response.writeHead(502, { "Content-Type": "application/json" });
    }
    if (!response.writableEnded) {
      response.end(JSON.stringify({ message: "Upstream service unavailable." }));
    }
  });

  request.pipe(upstream);
}

function writeResponseToSocket(clientSocket, upstreamResponse) {
  const statusCode = upstreamResponse.statusCode || 502;
  const statusLine = `HTTP/1.1 ${statusCode} ${
    upstreamResponse.statusMessage || http.STATUS_CODES[statusCode] || "Bad Gateway"
  }\r\n`;
  let headerLines = "";
  for (let i = 0; i < upstreamResponse.rawHeaders.length; i += 2) {
    const name = upstreamResponse.rawHeaders[i];
    const value = upstreamResponse.rawHeaders[i + 1];
    headerLines += `${name}: ${value}\r\n`;
  }
  clientSocket.write(statusLine + headerLines + "\r\n");
}

function proxyUpgrade(request, clientSocket, head) {
  const target = targetFor(pathnameOf(request.url || "/"));
  const headers = cleanHeaders(request.headers, true);
  headers.host = target.preserveHost
    ? request.headers.host || `localhost:${LISTEN_PORT}`
    : `${target.host}:${target.port}`;

  const upstream = http.request({
    host: target.host,
    port: target.port,
    method: request.method,
    path: request.url,
    headers,
  });

  upstream.on("upgrade", (upstreamResponse, upstreamSocket, upstreamHead) => {
    writeResponseToSocket(clientSocket, upstreamResponse);
    if (upstreamHead && upstreamHead.length) clientSocket.write(upstreamHead);
    if (head && head.length) upstreamSocket.write(head);
    upstreamSocket.pipe(clientSocket);
    clientSocket.pipe(upstreamSocket);
  });

  // A rejected origin is returned as a normal HTTP response (usually 403),
  // not as an upgrade event. Relay it so the client sees the real status.
  upstream.on("response", (upstreamResponse) => {
    writeResponseToSocket(clientSocket, upstreamResponse);
    upstreamResponse.pipe(clientSocket, { end: false });
    upstreamResponse.on("end", () => clientSocket.end());
  });

  upstream.on("error", (error) => {
    console.error("Edge proxy WebSocket error:", error.message);
    clientSocket.destroy();
  });

  upstream.end();
}

const server = http.createServer(proxyHttp);
server.on("upgrade", proxyUpgrade);
server.on("clientError", (error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(LISTEN_PORT, () => {
  console.log(
    `MediChannel edge proxy listening on ${LISTEN_PORT} -> Next ${NEXT_PORT}, backend ${BACKEND_PORT}`
  );
});
