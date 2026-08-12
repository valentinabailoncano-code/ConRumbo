from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import ssl
import os

os.chdir("frontend")

server = ThreadingHTTPServer(
    ("0.0.0.0", 3000),
    SimpleHTTPRequestHandler
)

context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)

context.load_cert_chain(
    certfile="../certs/10.32.86.31+2.pem",
    keyfile="../certs/10.32.86.31+2-key.pem"
)

server.socket = context.wrap_socket(
    server.socket,
    server_side=True
)

print("ConRumbo HTTPS funcionando en:")
print("https://10.32.86.31:3000")

server.serve_forever()