import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetchHtml, isPublicAddress, publicOnlyLookup } from "@/lib/safe-fetch";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", // private, loopback, cloud metadata
    "100.64.0.1", "100.100.100.200", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", // CGNAT, reserved, multicast
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", // IPv6 loopback, private, link-local
    "::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:a9fe:a9fe", "::ffff:7f00:1", // IPv4 written as IPv6
    "64:ff9b::a9fe:a9fe", // NAT64 to the metadata address
    "not an ip",
  ])("refuses %s", (ip) => expect(isPublicAddress(ip)).toBe(false));

  it.each(["8.8.8.8", "142.250.74.14", "172.32.0.1", "100.128.0.1", "2606:4700::6810:84e5", "::ffff:8.8.8.8"])("allows %s", (ip) =>
    expect(isPublicAddress(ip)).toBe(true),
  );
});

describe("publicOnlyLookup", () => {
  it("fails for a host that resolves to a private address", async () => {
    const error = await new Promise((resolve) => publicOnlyLookup("localhost", {}, (err) => resolve(err)));
    expect(error).toMatchObject({ code: "ENOTPUBLIC" });
  });
});

describe("fetchHtml against a server on this machine", () => {
  let server: Server;
  let port: number;
  const hits: string[] = [];
  beforeAll(async () => {
    server = createServer((req, res) => {
      hits.push(req.url ?? "");
      if (req.url === "/redirect") return res.writeHead(302, { location: `http://127.0.0.1:${port}/secret` }).end();
      res.writeHead(200, { "content-type": "text/html" }).end("<p>internal secret</p>");
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

  it("refuses every way of addressing it, without ever connecting", async () => {
    for (const url of [
      `http://localhost:${port}/`,
      `http://127.0.0.1:${port}/`,
      `http://[::ffff:127.0.0.1]:${port}/`,
      `http://2130706433:${port}/`, // 127.0.0.1 as one number
      `http://0x7f.1:${port}/`,
      `http://127.1:${port}/redirect`,
    ]) {
      expect(await fetchHtml(url), url).toBeNull();
    }
    expect(hits).toEqual([]);
  });

  it("only fetches http(s)", async () => {
    expect(await fetchHtml("file:///etc/passwd")).toBeNull();
    expect(await fetchHtml("ftp://example.com/")).toBeNull();
    expect(await fetchHtml("not a url")).toBeNull();
  });
});
