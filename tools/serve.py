import http.server, sys

class H(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        self.send_header("Cross-Origin-Resource-Policy", "same-origin")
        super().end_headers()

port = int(sys.argv[1])
root = sys.argv[2]
import functools
handler = functools.partial(H, directory=root)
http.server.HTTPServer(("127.0.0.1", port), handler).serve_forever()
