import { serveStatic as e } from "@hono/node-server/serve-static";
import t from "better-sqlite3";
import n from "fs";
import r from "path";
import i from "node:fs";
import a from "node:path";
//#region node_modules/hono/dist/compose.js
var o = (e, t, n) => (r, i) => {
	let a = -1;
	return o(0);
	async function o(s) {
		if (s <= a) throw Error("next() called multiple times");
		a = s;
		let c, l = !1, u;
		if (e[s] ? (u = e[s][0][0], r.req.routeIndex = s) : u = s === e.length && i || void 0, u) try {
			c = await u(r, () => o(s + 1));
		} catch (e) {
			if (e instanceof Error && t) r.error = e, c = await t(e, r), l = !0;
			else throw e;
		}
		else r.finalized === !1 && n && (c = await n(r));
		return c && (r.finalized === !1 || l) && (r.res = c), r;
	}
}, s = /* @__PURE__ */ Symbol(), c = (e, t) => new Response(e, { headers: { "Content-Type": t.replace(/^[^;]+/, (e) => e.toLowerCase()) } }).formData(), l = 32, u = 1e4, d = (e) => "headers" in e, f = async (e, t = /* @__PURE__ */ Object.create(null)) => {
	let { all: n = !1, dot: r = !1 } = t, i = (d(e) ? e.headers : e.raw.headers).get("Content-Type")?.split(";")[0].trim().toLowerCase();
	return i === "multipart/form-data" || i === "application/x-www-form-urlencoded" ? p(e, {
		all: n,
		dot: r
	}) : {};
};
async function p(e, t) {
	if (!d(e) && e.bodyCache.formData) return m(await e.bodyCache.formData, t);
	let n = d(e) ? e.headers : e.raw.headers, r = c(await e.arrayBuffer(), n.get("Content-Type") || "");
	d(e) || (e.bodyCache.formData = r);
	let i = await r;
	return i ? m(i, t) : {};
}
function m(e, t) {
	let n = /* @__PURE__ */ Object.create(null), r = { count: 0 };
	return e.forEach((e, r) => {
		t.all || r.endsWith("[]") ? h(n, r, e) : n[r] = e;
	}), t.dot && Object.entries(n).forEach(([e, t]) => {
		e.includes(".") && (g(n, e, t, r), delete n[e]);
	}), n;
}
var h = (e, t, n) => {
	e[t] === void 0 ? e[t] = t.endsWith("[]") ? [n] : n : Array.isArray(e[t]) ? e[t].push(n) : e[t] = [e[t], n];
}, g = (e, t, n, r) => {
	if (/(?:^|\.)__proto__\./.test(t)) return;
	let i = e, a = t.split(".", l + 2);
	a.length > l + 1 && _(), a.forEach((e, t) => {
		t === a.length - 1 ? i[e] = n : ((!i[e] || typeof i[e] != "object" || Array.isArray(i[e]) || i[e] instanceof File) && (r.count++ >= u && _(), i[e] = /* @__PURE__ */ Object.create(null)), i = i[e]);
	});
}, _ = () => {
	throw Error("Nesting limit exceeded");
}, v = (e) => {
	let t = e.split("/");
	return t[0] === "" && t.shift(), t;
}, y = (e) => {
	let { groups: t, path: n } = b(e);
	return x(v(n), t);
}, b = (e) => {
	let t = [];
	return e = e.replace(/\{[^}]+\}/g, (e, n) => {
		let r = `@${n}`;
		return t.push([r, e]), r;
	}), {
		groups: t,
		path: e
	};
}, x = (e, t) => {
	for (let n = t.length - 1; n >= 0; n--) {
		let [r] = t[n];
		for (let i = e.length - 1; i >= 0; i--) if (e[i].includes(r)) {
			e[i] = e[i].replace(r, t[n][1]);
			break;
		}
	}
	return e;
}, S = {}, C = (e, t) => {
	if (e === "*") return "*";
	let n = e.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
	if (n) {
		let r = `${e}#${t}`;
		return S[r] || (S[r] = n[2] ? t && t[0] !== ":" && t[0] !== "*" ? [
			r,
			n[1],
			RegExp(`^${n[2]}(?=/${t})`)
		] : [
			e,
			n[1],
			RegExp(`^${n[2]}$`)
		] : [
			e,
			n[1],
			!0
		]), S[r];
	}
	return null;
}, w = (e, t) => {
	try {
		return t(e);
	} catch {
		return e.replace(/(?:%[0-9A-Fa-f]{2})+/g, (e) => {
			try {
				return t(e);
			} catch {
				return e;
			}
		});
	}
}, T = (e) => w(e, decodeURI), E = (e) => {
	let t = e.url, n = t.indexOf("/", t.indexOf(":") + 4), r = n;
	for (; r < t.length; r++) {
		let e = t.charCodeAt(r);
		if (e === 37) {
			let e = t.indexOf("?", r), i = t.indexOf("#", r), a = e === -1 ? i === -1 ? void 0 : i : i === -1 ? e : Math.min(e, i), o = t.slice(n, a);
			return T(o.includes("%25") ? o.replace(/%25/g, "%2525") : o);
		}
		if (e === 63 || e === 35) break;
	}
	return t.slice(n, r);
}, D = (e) => {
	let t = E(e);
	return t.length > 1 && t.at(-1) === "/" ? t.slice(0, -1) : t;
}, O = (e, t, ...n) => (n.length && (t = O(t, ...n)), `${e?.[0] === "/" ? "" : "/"}${e}${t === "/" ? "" : `${e?.at(-1) === "/" ? "" : "/"}${t?.[0] === "/" ? t.slice(1) : t}`}`), ee = (e) => {
	if (e.charCodeAt(e.length - 1) !== 63 || !e.includes(":")) return null;
	let t = e.split("/"), n = [], r = "";
	return t.forEach((e) => {
		if (e !== "" && !/\:/.test(e)) r += "/" + e;
		else if (/\:/.test(e)) {
			if (e.charCodeAt(e.length - 1) === 63) {
				n.length === 0 && r === "" ? n.push("/") : n.push(r);
				let t = e.slice(0, -1);
				r += "/" + t, n.push(r);
			} else r += "/" + e;
		}
	}), n.filter((e, t, n) => n.indexOf(e) === t);
}, te = (e) => e.indexOf("%") === -1 ? e : w(e, ae), k = (e) => (e.indexOf("+") !== -1 && (e = e.replace(/\+/g, " ")), te(e)), ne = (e, t, n) => {
	let r = e.indexOf("#", 8);
	r !== -1 && (e = e.slice(0, r));
	let i;
	if (!n && t && t.indexOf("%") === -1 && t.indexOf("+") === -1) {
		let n = e.indexOf("?", 8);
		if (n === -1) return;
		for (e.startsWith(t, n + 1) || (n = e.indexOf(`&${t}`, n + 1)); n !== -1;) {
			let r = e.charCodeAt(n + t.length + 1);
			if (r === 61) {
				let r = n + t.length + 2, i = e.indexOf("&", r);
				return k(e.slice(r, i === -1 ? void 0 : i));
			}
			if (r == 38 || isNaN(r)) return "";
			n = e.indexOf(`&${t}`, n + 1);
		}
		if (i = /[%+]/.test(e), !i) return;
	}
	let a = /* @__PURE__ */ Object.create(null);
	i ??= /[%+]/.test(e);
	let o = e.indexOf("?", 8);
	for (; o !== -1;) {
		let t = e.indexOf("&", o + 1), r = e.indexOf("=", o);
		r > t && t !== -1 && (r = -1);
		let s = e.slice(o + 1, r === -1 ? t === -1 ? void 0 : t : r);
		if (i && (s = k(s)), o = t, s === "") continue;
		let c;
		r === -1 ? c = "" : (c = e.slice(r + 1, t === -1 ? void 0 : t), i && (c = k(c))), n ? (a[s] && Array.isArray(a[s]) || (a[s] = []), a[s].push(c)) : a[s] ??= c;
	}
	return t ? a[t] : a;
}, re = ne, ie = (e, t) => ne(e, t, !0), ae = decodeURIComponent, oe = class {
	raw;
	#e;
	#t;
	routeIndex = 0;
	path;
	bodyCache = {};
	constructor(e, t = "/", n = [[]]) {
		this.raw = e, this.path = t, this.#t = n;
	}
	param(e) {
		return e ? this.#n(e) : this.#r();
	}
	#n(e) {
		let t = this.#t[0][this.routeIndex]?.[1][e], n = this.#i(t);
		return n && te(n);
	}
	#r() {
		let e = {}, t = Object.keys(this.#t[0][this.routeIndex]?.[1] ?? {});
		for (let n of t) {
			let t = this.#i(this.#t[0][this.routeIndex][1][n]);
			t !== void 0 && (e[n] = te(t));
		}
		return e;
	}
	#i(e) {
		return this.#t[1] ? this.#t[1][e] : e;
	}
	query(e) {
		return re(this.url, e);
	}
	queries(e) {
		return ie(this.url, e);
	}
	header(e) {
		if (e) return this.raw.headers.get(e) ?? void 0;
		let t = /* @__PURE__ */ Object.create(null);
		return this.raw.headers.forEach((e, n) => {
			t[n] = e;
		}), t;
	}
	async parseBody(e) {
		return f(this, e);
	}
	#a = (e) => {
		let { bodyCache: t, raw: n } = this, r = t[e];
		if (r) return r;
		for (let n in t) return t[n].then((t) => (n === "json" && (t = JSON.stringify(t)), new Response(t)[e]()));
		return t[e] = n[e]();
	};
	json() {
		return this.#a("text").then((e) => JSON.parse(e));
	}
	text() {
		return this.#a("text");
	}
	arrayBuffer() {
		return this.#a("arrayBuffer");
	}
	bytes() {
		return this.#a("arrayBuffer").then((e) => new Uint8Array(e));
	}
	blob() {
		return this.#a("blob");
	}
	formData() {
		return this.#a("formData");
	}
	addValidatedData(e, t) {
		(this.#e ??= {})[e] = t;
	}
	valid(e) {
		return this.#e?.[e];
	}
	get url() {
		return this.raw.url;
	}
	get method() {
		return this.raw.method;
	}
	get [s]() {
		return this.#t;
	}
	get matchedRoutes() {
		return this.#t[0].map(([[, e]]) => e);
	}
	get routePath() {
		return this.#t[0].map(([[, e]]) => e)[this.routeIndex].path;
	}
}, se = {
	Stringify: 1,
	BeforeStream: 2,
	Stream: 3
}, ce = (e, t) => {
	let n = new String(e);
	return n.isEscaped = !0, n.callbacks = t, n;
}, le = async (e, t, n, r, i) => {
	typeof e == "object" && !(e instanceof String) && (e instanceof Promise || (e = e.toString()), e instanceof Promise && (e = await e));
	let a = e.callbacks;
	if (!a?.length) return Promise.resolve(e);
	i ? i[0] += e : i = [e];
	let o = Promise.all(a.map((e) => e({
		phase: t,
		buffer: i,
		context: r
	}))).then((e) => Promise.all(e.filter(Boolean).map((e) => le(e, t, !1, r, i))).then(() => i[0]));
	return n ? ce(await o, a) : o;
}, ue = "text/plain; charset=UTF-8", de = (e, t) => ({
	"Content-Type": e,
	...t
}), A = (e, t) => new Response(e, t), fe = class {
	#e;
	#t;
	env = {};
	#n;
	finalized = !1;
	error;
	#r;
	#i;
	#a;
	#o;
	#s;
	#c;
	#l;
	#u;
	#d;
	constructor(e, t) {
		this.#e = e, t && (this.#i = t.executionCtx, this.env = t.env, this.#c = t.notFoundHandler, this.#d = t.path, this.#u = t.matchResult);
	}
	get req() {
		return this.#t ??= new oe(this.#e, this.#d, this.#u), this.#t;
	}
	get event() {
		if (this.#i && "respondWith" in this.#i) return this.#i;
		throw Error("This context has no FetchEvent");
	}
	get executionCtx() {
		if (this.#i) return this.#i;
		throw Error("This context has no ExecutionContext");
	}
	get res() {
		return this.#a ||= A(null, { headers: this.#l ??= new Headers() });
	}
	set res(e) {
		if (this.#a && e) {
			e = A(e.body, e);
			for (let [t, n] of this.#a.headers.entries()) if (t !== "content-type") {
				if (t === "set-cookie") {
					let t = this.#a.headers.getSetCookie();
					e.headers.delete("set-cookie");
					for (let n of t) e.headers.append("set-cookie", n);
				} else e.headers.set(t, n);
			}
		}
		this.#a = e, this.finalized = !0;
	}
	render = (...e) => (this.#s ??= (e) => this.html(e), this.#s(...e));
	setLayout = (e) => this.#o = e;
	getLayout = () => this.#o;
	setRenderer = (e) => {
		this.#s = e;
	};
	header = (e, t, n) => {
		this.finalized && (this.#a = A(this.#a.body, this.#a));
		let r = this.#a ? this.#a.headers : this.#l ??= new Headers();
		t === void 0 ? r.delete(e) : n?.append ? r.append(e, t) : r.set(e, t);
	};
	status = (e) => {
		this.#r = e;
	};
	set = (e, t) => {
		this.#n ??= /* @__PURE__ */ new Map(), this.#n.set(e, t);
	};
	get = (e) => this.#n ? this.#n.get(e) : void 0;
	get var() {
		return this.#n ? Object.fromEntries(this.#n) : {};
	}
	#f(e, t, n) {
		let r = this.#a ? new Headers(this.#a.headers) : this.#l;
		if (typeof t == "object" && t.headers) {
			r ??= new Headers();
			for (let [e, n] of new Headers(t.headers)) e === "set-cookie" ? r.append(e, n) : r.set(e, n);
		}
		if (n) {
			if (!r) {
				let e = 0;
				for (let t in n) if (++e > 1 || typeof n[t] != "string") {
					r = new Headers();
					break;
				}
			}
			if (r) for (let e in n) {
				let t = n[e];
				if (typeof t == "string") r.set(e, t);
				else {
					r.delete(e);
					for (let n of t) r.append(e, n);
				}
			}
		}
		return A(e, {
			status: typeof t == "number" ? t : t?.status ?? this.#r,
			headers: r ?? n
		});
	}
	newResponse = (...e) => this.#f(...e);
	body = (e, t, n) => this.#f(e, t, n);
	text = (e, t, n) => !this.#l && !this.#r && !t && !n && !this.finalized ? new Response(e) : this.#f(e, t, de(ue, n));
	json = (e, t, n) => this.#f(JSON.stringify(e), t, de("application/json", n));
	html = (e, t, n) => {
		let r = (e) => this.#f(e, t, de("text/html; charset=UTF-8", n));
		return typeof e == "object" ? le(e, se.Stringify, !1, {}).then(r) : r(e);
	};
	redirect = (e, t) => {
		let n = String(e);
		return this.header("Location", /[^\x00-\xFF]/.test(n) ? encodeURI(n) : n), this.newResponse(null, t ?? 302);
	};
	notFound = () => (this.#c ??= () => A(), this.#c(this));
}, pe = [
	"get",
	"post",
	"put",
	"delete",
	"options",
	"patch",
	"query"
], me = "Can not add a route since the matcher is already built.", he = class extends Error {}, ge = "__COMPOSED_HANDLER", _e = (e) => e.text("404 Not Found", 404), ve = (e, t) => {
	if ("getResponse" in e) {
		let n = e.getResponse();
		return t.newResponse(n.body, n);
	}
	return console.error(e), t.text("Internal Server Error", 500);
}, ye = class e {
	get;
	post;
	put;
	delete;
	options;
	patch;
	query;
	all;
	on;
	use;
	router;
	getPath;
	_basePath = "/";
	#e = "/";
	routes = [];
	constructor(e = {}) {
		[...pe, "all"].forEach((e) => {
			this[e] = (t, ...n) => (typeof t == "string" ? this.#e = t : this.#r(e, this.#e, t), n.forEach((t) => {
				this.#r(e, this.#e, t);
			}), this);
		}), this.on = (e, t, ...n) => {
			for (let r of [t].flat()) {
				this.#e = r;
				for (let t of [e].flat()) n.map((e) => {
					this.#r(t.toUpperCase(), this.#e, e);
				});
			}
			return this;
		}, this.use = (e, ...t) => (typeof e == "string" ? this.#e = e : (this.#e = "*", t.unshift(e)), t.forEach((e) => {
			this.#r("ALL", this.#e, e);
		}), this);
		let { strict: t, ...n } = e;
		Object.assign(this, n), this.getPath = t ?? !0 ? e.getPath ?? E : D;
	}
	#t() {
		let t = new e({
			router: this.router,
			getPath: this.getPath
		});
		return t.errorHandler = this.errorHandler, t.#n = this.#n, t.routes = this.routes, t;
	}
	#n = _e;
	errorHandler = ve;
	route(e, t) {
		let n = this.basePath(e);
		return t.routes.map((e) => {
			let r;
			t.errorHandler === ve ? r = e.handler : (r = async (n, r) => (await o([], t.errorHandler)(n, () => e.handler(n, r))).res, r[ge] = e.handler), n.#r(e.method, e.path, r, e.basePath);
		}), this;
	}
	basePath(e) {
		let t = this.#t();
		return t._basePath = O(this._basePath, e), t;
	}
	onError = (e) => (this.errorHandler = e, this);
	notFound = (e) => (this.#n = e, this);
	mount(e, t, n) {
		let r, i;
		n && (typeof n == "function" ? i = n : (i = n.optionHandler, r = n.replaceRequest === !1 ? (e) => e : n.replaceRequest));
		let a = i ? (e) => {
			let t = i(e);
			return Array.isArray(t) ? t : [t];
		} : (e) => {
			let t;
			try {
				t = e.executionCtx;
			} catch {}
			return [e.env, t];
		};
		return r ||= (() => {
			let t = O(this._basePath, e), n = t === "/" ? 0 : t.length;
			return (e) => {
				let t = new URL(e.url);
				return t.pathname = this.getPath(e).slice(n) || "/", new Request(t, e);
			};
		})(), this.#r("ALL", O(e, "*"), async (e, n) => {
			let i = await t(r(e.req.raw), ...a(e));
			if (i) return i;
			await n();
		}), this;
	}
	#r(e, t, n, r) {
		e = e.toUpperCase(), t = O(this._basePath, t);
		let i = {
			basePath: r === void 0 ? this._basePath : O(this._basePath, r),
			path: t,
			method: e,
			handler: n
		};
		this.router.add(e, t, [n, i]), this.routes.push(i);
	}
	#i(e, t) {
		if (e instanceof Error) return this.errorHandler(e, t);
		throw e;
	}
	#a(e, t, n, r) {
		if (r === "HEAD") return (async () => new Response(null, await this.#a(e, t, n, "GET")))();
		let i = this.getPath(e, { env: n }), a = this.router.match(r, i), s = new fe(e, {
			path: i,
			matchResult: a,
			env: n,
			executionCtx: t,
			notFoundHandler: this.#n
		});
		if (a[0].length === 1) {
			let e;
			try {
				e = a[0][0][0][0](s, async () => {
					s.res = await this.#n(s);
				});
			} catch (e) {
				return this.#i(e, s);
			}
			return e instanceof Promise ? e.then((e) => e || (s.finalized ? s.res : this.#n(s))).catch((e) => this.#i(e, s)) : e ?? this.#n(s);
		}
		let c = o(a[0], this.errorHandler, this.#n);
		return (async () => {
			try {
				let e = await c(s);
				if (!e.finalized) throw Error("Context is not finalized. Did you forget to return a Response object or `await next()`?");
				return e.res;
			} catch (e) {
				return this.#i(e, s);
			}
		})();
	}
	fetch = (e, ...t) => this.#a(e, t[1], t[0], e.method);
	request = (e, t, n, r) => e instanceof Request ? this.fetch(t ? new Request(e, t) : e, n, r) : (e = e.toString(), this.fetch(new Request(/^https?:\/\//.test(e) ? e : `http://localhost${O("/", e)}`, t), n, r));
	fire = () => {
		addEventListener("fetch", (e) => {
			e.respondWith(this.#a(e.request, e, void 0, e.request.method));
		});
	};
}, j = () => /* @__PURE__ */ Object.create(null), be = [];
function xe(e, t) {
	let n = this.buildAllMatchers(), r = ((e, t) => {
		let r = n[e] || n.ALL, i = r[2][t];
		if (i) return i;
		let a = t.match(r[0]);
		if (!a) return [[], be];
		let o = a.indexOf("", 1);
		return [r[1][o], a];
	});
	return this.match = r, r(e, t);
}
//#endregion
//#region node_modules/hono/dist/router/reg-exp-router/node.js
var Se = "[^/]+", Ce = "(?:|/.*)", M = /* @__PURE__ */ Symbol(), we = /* @__PURE__ */ new Set(".\\+*[^]$()");
function Te(e, t) {
	return e.length === 1 ? t.length === 1 ? e < t ? -1 : 1 : -1 : t.length === 1 ? 1 : e === ".*" || e === "(?:|/.*)" ? t === "(?:|/.*)" ? -1 : 1 : t === ".*" || t === "(?:|/.*)" ? -1 : e === "[^/]+" ? 1 : t === "[^/]+" ? -1 : e.length === t.length ? e < t ? -1 : 1 : t.length - e.length;
}
var Ee = class e {
	#e;
	#t;
	#n = j();
	insert(t, n, r, i, a) {
		let o = this;
		for (let n = 0, a = t.length; n < a; n++) {
			let s = t[n], c = s.length === 1 ? s === "*" ? n === a - 1 ? [
				"",
				"",
				".*"
			] : [
				"",
				"",
				Se
			] : null : s === "/*" ? [
				"",
				"",
				Ce
			] : s.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/), l;
			if (c) {
				let t = c[1], n = c[2] || "[^/]+";
				if (t && c[2] && (n === ".*" || (n = n.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:"), /\((?!\?:)/.test(n)) || n.length === 1 && we.has(n))) throw M;
				if (l = o.#n[n], !l) {
					if (n !== ".*" && n !== "(?:|/.*)") {
						for (let e in o.#n) if ((n.length > 1 || e.length > 1) && e !== ".*" && e !== "(?:|/.*)") throw M;
					}
					l = o.#n[n] = new e();
				}
				t !== "" && (l.#t ??= i.varIndex++, r.push([t, l.#t]));
			} else if (l = o.#n[s], !l) {
				for (let e in o.#n) if (e.length > 1 && e !== ".*" && e !== "(?:|/.*)") throw M;
				l = o.#n[s] = new e();
			}
			o = l;
		}
		if (o.#e !== void 0) throw M;
		o.#e = a ? -1 : n;
	}
	buildRegExpStr() {
		let e = Object.keys(this.#n).sort(Te).map((e) => {
			let t = this.#n[e], n = t.buildRegExpStr();
			return n === "" ? "" : (typeof t.#t == "number" ? `(${e})@${t.#t}` : we.has(e) ? `\\${e}` : e) + n;
		}).filter(Boolean);
		return typeof this.#e == "number" && this.#e !== -1 && e.unshift(`#${this.#e}`), e.length === 0 ? "" : e.length === 1 ? e[0] : "(?:" + e.join("|") + ")";
	}
}, De = class {
	#e = { varIndex: 0 };
	#t = new Ee();
	#n = 0;
	paths = j();
	insert(e, t) {
		if (t) {
			this.#t.insert(e.split(""), 0, [], this.#e, !0);
			return;
		}
		let n = [], r = [], i = e;
		for (let e = 0;;) {
			let t = !1;
			if (i = i.replace(/\{[^}]+\}/g, (n) => {
				let i = `@\\${e}`;
				return r[e] = [i, n], e++, t = !0, i;
			}), !t) break;
		}
		let a = i.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
		for (let e = r.length - 1; e >= 0; e--) {
			let [t] = r[e];
			for (let n = a.length - 1; n >= 0; n--) if (a[n].indexOf(t) !== -1) {
				a[n] = a[n].replace(t, r[e][1]);
				break;
			}
		}
		this.#t.insert(a, this.#n, n, this.#e, !1), this.paths[e] = [this.#n++, n];
	}
	buildRegExp() {
		let e = this.#t.buildRegExpStr();
		if (e === "") return [
			/^$/,
			[],
			[]
		];
		let t = 0, n = [], r = [];
		return e = e.replace(/#(\d+)|@(\d+)|\.\*\$/g, (e, i, a) => i === void 0 ? (a === void 0 || (r[Number(a)] = ++t), "") : (n[++t] = Number(i), "$()")), [
			RegExp(`^${e}`),
			n,
			r
		];
	}
}, Oe = j();
function ke(e) {
	return Oe[e] ??= RegExp(`^${e.replace(/\/:[^/{}]+(?:\{\[\^\/]\+})?(?=[/{]|$)|\/?\*$|([.\\+*[^\]$()?{}|])/g, (e, t) => t ? `\\${t}` : e === "/*" ? Ce : e === "*" ? ".*" : `/:${Se}`)}$`);
}
function N(e, t) {
	for (let n of Object.keys(e).sort((e, t) => t.length - e.length)) if (ke(n).test(t)) return [...e[n]];
}
var Ae = class {
	name = "RegExpRouter";
	#e;
	#t;
	#n;
	constructor() {
		this.#e = { ALL: j() }, this.#t = { ALL: j() }, this.#n = { ALL: new De() };
	}
	#r(e, t) {
		try {
			this.#n[e].insert(t, !/\*|\/:/.test(t));
		} catch (e) {
			throw e === M ? new he(t) : e;
		}
	}
	add(e, t, n) {
		let r = this.#e, i = this.#t;
		if (!r) throw Error(me);
		if (!r[e]) {
			this.#n[e] = new De();
			for (let t of [r, i]) {
				t[e] = j();
				for (let n in t.ALL) t[e][n] = [...t.ALL[n]], this.#r(e, n);
			}
		}
		t === "/*" && (t = "*");
		let a = e === "ALL" ? Object.keys(r) : [e];
		if (/\*$/.test(t)) {
			let e = ke(t);
			for (let e of a) r[e][t] || (this.#r(e, t), r[e][t] = N(r[e], t) || N(r.ALL, t) || []);
			for (let o of [r, i]) for (let r of a) for (let i in o[r]) e.test(i) && o[r][i].push([n, t]);
			return;
		}
		let o = ee(t) || [t];
		for (let e of o) for (let t of a) i[t][e] || (this.#r(t, e), i[t][e] = N(r[t], e) || N(r.ALL, e) || []), i[t][e].push([n, e]);
	}
	match = xe;
	buildAllMatchers() {
		let e = j();
		for (let t of Object.keys(this.#t)) e[t] = this.#i(t);
		return this.#e = this.#t = this.#n = void 0, Oe = j(), e;
	}
	#i(e) {
		let t = this.#e[e], n = this.#t[e], r = this.#n[e], i = j(), a = [], [o, s, c] = r.buildRegExp();
		for (let e of [t, n]) for (let t in e) {
			let n = e[t], o = r.paths[t];
			if (!o) {
				i[t] = [n.map(([e]) => [e, j()]), be];
				continue;
			}
			a[o[0]] = n.map(([e, t]) => [e, r.paths[t][1].reduceRight((e, [t], n) => (e[t] = c[o[1][n][1]], e), j())]);
		}
		return [
			o,
			s.map((e) => a[e]),
			i
		];
	}
}, je = class {
	name = "SmartRouter";
	#e = [];
	#t = [];
	constructor(e) {
		this.#e = e.routers;
	}
	add(e, t, n) {
		if (!this.#t) throw Error(me);
		this.#t.push([
			e,
			t,
			n
		]);
	}
	match(e, t) {
		if (!this.#t) throw Error("Fatal error");
		let n = this.#e, r = this.#t, i = n.length, a = 0, o;
		for (; a < i; a++) {
			let i = n[a];
			try {
				for (let e = 0, t = r.length; e < t; e++) i.add(...r[e]);
				o = i.match(e, t);
			} catch (e) {
				if (e instanceof he) continue;
				throw e;
			}
			this.match = i.match.bind(i), this.#e = [i], this.#t = void 0;
			break;
		}
		if (a === i) throw Error("Fatal error");
		return this.name = `SmartRouter + ${this.activeRouter.name}`, o;
	}
	get activeRouter() {
		if (this.#t || this.#e.length !== 1) throw Error("No active router has been determined yet.");
		return this.#e[0];
	}
}, Me = j(), Ne = 0, Pe = class e {
	#e = [];
	#t = j();
	#n = [];
	#r;
	#i = Me;
	insert(t, n, r) {
		let i = this, a = y(n), o = /* @__PURE__ */ new Set(), s = 0;
		for (let t of a) {
			let n = a[++s], r = C(t, n) || (n === void 0 && t && t.indexOf("*") === t.length - 1 ? t : null), c = Array.isArray(r), l = c ? r[0] : r || t, u = i.#t[l] ||= new e();
			r && !u.#r && (u.#r = r, i.#n.push(u)), i = u, c && o.add(r[1]);
		}
		i.#e.push({ [t]: {
			handler: r,
			possibleKeys: [...o],
			score: ++Ne
		} });
	}
	#a(e, t, n, r, i) {
		for (let a = 0, o = t.#e.length; a < o; a++) {
			let o = t.#e[a], s = o[n] || o.ALL;
			if (s) {
				s.params = j(), e.push(s);
				for (let e = 0, t = s.possibleKeys.length; e < t; e++) {
					let t = s.possibleKeys[e];
					s.params[t] = i?.[t] && !e ? i[t] : r[t] ?? i?.[t];
				}
			}
		}
	}
	search(e, t) {
		let n = [];
		this.#i = Me;
		let r = [this], i = v(t), a = [], o = i.length, s = null;
		for (let c = 0; c < o; c++) {
			let l = i[c], u = c === o - 1, d = [];
			for (let f = 0, p = r.length; f < p; f++) {
				let p = r[f], m = p.#t[l];
				m && (m.#i = p.#i, u ? (m.#t["*"] && this.#a(n, m.#t["*"], e, p.#i), this.#a(n, m, e, p.#i)) : d.push(m));
				for (let r of p.#n) {
					let f = r.#r, m = p.#i === Me ? {} : { ...p.#i };
					if (typeof f == "string") {
						(f === "*" || l.startsWith(f.slice(0, -1))) && (this.#a(n, r, e, p.#i), f === "*" && (r.#i = m, d.push(r)));
						continue;
					}
					let [, h, g] = f;
					if (!(!l && g === !0)) {
						if (g !== !0) {
							if (!s) {
								s = [];
								let e = +(t[0] === "/");
								for (let t = 0; t < o; t++) s[t] = e, e += i[t].length + 1;
							}
							let l = t.slice(s[c]), u = g.exec(l);
							if (u) {
								m[h] = u[0], this.#a(n, r, e, p.#i, m), u[0].length === l.length && r.#t["*"] && this.#a(n, r.#t["*"], e, p.#i, m);
								for (let e in r.#t) {
									r.#i = m;
									let e = u[0].match(/\//g)?.length ?? 0;
									(a[e] ||= []).push(r);
									break;
								}
								continue;
							}
						}
						(g === !0 || g.test(l)) && (m[h] = l, u ? (this.#a(n, r, e, m, p.#i), r.#t["*"] && this.#a(n, r.#t["*"], e, m, p.#i)) : (r.#i = m, d.push(r)));
					}
				}
			}
			let f = a.shift();
			r = f ? d.concat(f) : d;
		}
		return n[1] && n.sort((e, t) => e.score - t.score), [n.map(({ handler: e, params: t }) => [e, t])];
	}
}, Fe = class {
	name = "TrieRouter";
	#e = new Pe();
	add(e, t, n) {
		for (let r of ee(t) || [t]) this.#e.insert(e, r, n);
	}
	match(e, t) {
		return this.#e.search(e, t);
	}
}, P = class extends ye {
	constructor(e = {}) {
		super(e), this.router = e.router ?? new je({ routers: [new Ae(), new Fe()] });
	}
}, Ie = (e) => {
	let t = {
		origin: "*",
		allowMethods: [
			"GET",
			"HEAD",
			"PUT",
			"POST",
			"DELETE",
			"PATCH",
			"QUERY"
		],
		allowHeaders: [],
		exposeHeaders: [],
		...e
	}, n = t.exposeHeaders?.length ? t.exposeHeaders.join(",") : void 0, r = t.allowHeaders?.length ? t.allowHeaders.join(",") : void 0, i = ((e) => typeof e == "string" ? e === "*" ? () => e : (t) => e === t ? t : null : typeof e == "function" ? e : (t) => e.includes(t) ? t : null)(t.origin), a = ((e) => {
		if (typeof e == "function") return async (t, n) => (await e(t, n)).join(",");
		if (Array.isArray(e)) {
			let t = e.join(",");
			return () => t;
		}
		return () => "";
	})(t.allowMethods);
	return async function(e, o) {
		function s(t, n) {
			e.res.headers.set(t, n);
		}
		let c = await i(e.req.header("origin") || "", e);
		if (c && s("Access-Control-Allow-Origin", c), t.credentials && s("Access-Control-Allow-Credentials", "true"), n && s("Access-Control-Expose-Headers", n), e.req.method === "OPTIONS") {
			t.origin !== "*" && e.res.headers.append("Vary", "Origin"), t.maxAge != null && s("Access-Control-Max-Age", t.maxAge.toString());
			let n = await a(e.req.header("origin") || "", e);
			n && s("Access-Control-Allow-Methods", n);
			let i = r;
			if (!i) {
				let t = e.req.header("Access-Control-Request-Headers");
				t && (i = t.split(",").map((e) => e.trim()).join(","));
			}
			return i && (s("Access-Control-Allow-Headers", i), e.res.headers.append("Vary", "Access-Control-Request-Headers")), e.res.headers.delete("Content-Length"), e.res.headers.delete("Content-Type"), new Response(null, {
				headers: e.res.headers,
				status: 204,
				statusText: "No Content"
			});
		}
		await o(), t.origin !== "*" && e.header("Vary", "Origin", { append: !0 });
	};
}, Le = process.env.DB_PATH || "./data/app.db", Re = r.dirname(Le);
n.existsSync(Re) || n.mkdirSync(Re, { recursive: !0 });
var F = new t(Le);
F.pragma("journal_mode = WAL"), F.pragma("foreign_keys = ON");
var ze = [
	"./migrations/0001_initial.sql",
	"./migrations/0002_seed.sql",
	"./migrations/0003_portal_columns.sql",
	"./migrations/0004_project_images.sql",
	"./migrations/0005_pge_foundation.sql",
	"./migrations/0006_align_existing_products.sql"
];
function Be() {
	let e = r.resolve("./migrations");
	if (!n.existsSync(e)) {
		console.log("[db-adapter] migrations/ directory not found — skipping auto-migration");
		return;
	}
	if (F.exec("\n    CREATE TABLE IF NOT EXISTS schema_migrations (\n      filename TEXT PRIMARY KEY,\n      applied_at TEXT DEFAULT (datetime('now'))\n    )\n  "), F.prepare("SELECT COUNT(*) as n FROM schema_migrations").get().n === 0 && F.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='products'").get()) {
		let e = F.prepare("PRAGMA table_info(products)").all(), t = e.length;
		console.log(`[db-adapter] Adopting pre-existing DB (products has ${t} columns) — marking migrations as applied`), F.prepare("INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)").run("0001_initial.sql"), F.prepare("INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)").run("0002_seed.sql"), e.some((e) => e.name === "portal_visible") && F.prepare("INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)").run("0003_portal_columns.sql");
		let n = F.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='project_images'").get(), r = F.prepare("PRAGMA table_info(projects)").all().some((e) => e.name === "image_urls");
		(n || r) && F.prepare("INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)").run("0004_project_images.sql");
	}
	console.log("[db-adapter] Running auto-migrations...");
	for (let e of ze) {
		let t = r.resolve(e);
		if (!n.existsSync(t)) {
			console.log(`[db-adapter] Migration not found, skipping: ${e}`);
			continue;
		}
		let i = r.basename(e);
		if (F.prepare("SELECT 1 FROM schema_migrations WHERE filename = ?").get(i)) {
			if (i === "0002_seed.sql") {
				if (F.prepare("SELECT COUNT(*) as n FROM products").get().n === 0) console.log("[db-adapter] Seed marked applied but products table is empty — re-running seed"), F.prepare("DELETE FROM schema_migrations WHERE filename = ?").run(i);
				else {
					console.log(`[db-adapter] Already applied, skipping: ${e}`);
					continue;
				}
			} else {
				console.log(`[db-adapter] Already applied, skipping: ${e}`);
				continue;
			}
		}
		try {
			let r = n.readFileSync(t, "utf8");
			F.exec(r), F.prepare("INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)").run(i), console.log(`[db-adapter] Applied: ${e}`);
		} catch (t) {
			let n = t instanceof Error ? t.message : String(t);
			if (n.includes("already exists") || n.includes("duplicate column")) F.prepare("INSERT OR IGNORE INTO schema_migrations (filename) VALUES (?)").run(i), console.log(`[db-adapter] Already applied (idempotent): ${e}`);
			else throw console.error(`[db-adapter] Error applying ${e}:`, n), t;
		}
	}
	let t = F.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
	console.log("[db-adapter] Tables:", t.map((e) => e.name).join(", "));
}
Be();
function Ve(e, t) {
	try {
		let n = e.run(...t);
		return {
			results: [],
			success: !0,
			meta: {
				last_row_id: Number(n.lastInsertRowid),
				changes: n.changes
			}
		};
	} catch (e) {
		throw e;
	}
}
function I(e, t = []) {
	return {
		all: async () => ({
			results: F.prepare(e).all(...t),
			success: !0,
			meta: {
				last_row_id: 0,
				changes: 0
			}
		}),
		first: async () => F.prepare(e).get(...t) ?? null,
		run: async () => Ve(F.prepare(e), t)
	};
}
var L = { prepare: (e) => ({
	bind: (...t) => I(e, t),
	all: () => I(e, []).all(),
	first: () => I(e, []).first(),
	run: () => I(e, []).run()
}) };
//#endregion
//#region src/lib/db.ts
function R(e = "") {
	return `${e}${Date.now().toString(36)}${Math.random().toString(36).substring(2, 8)}`;
}
function z() {
	return (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").split(".")[0];
}
async function B(e, { userId: t = "system", userName: n = "System", userRole: r = "system", action: i, entityType: a, entityId: o, details: s = {}, source: c = "manual", aiConfidence: l, regulatoryReference: u }) {
	let d = R("al");
	await e.prepare("\n    INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, details, source, ai_confidence, regulatory_reference, created_at)\n    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)\n  ").bind(d, t, n, r, i, a || null, o || null, JSON.stringify(s), c, l || null, u || null, z()).run();
}
//#endregion
//#region src/api/products.ts
var V = new P();
V.get("/", async (e) => {
	let { results: t } = await e.env.DB.prepare("SELECT * FROM products ORDER BY category, name").all();
	return e.json({ products: t });
}), V.get("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();
	if (!n) return e.json({ error: "Not found" }, 404);
	let { results: r } = await e.env.DB.prepare("SELECT * FROM rules WHERE product_id = ? OR product_id IS NULL ORDER BY category, name").bind(t).all();
	return e.json({
		product: n,
		rules: r
	});
}), V.post("/", async (e) => {
	let t = await e.req.json(), n = R("p"), r = z();
	return await e.env.DB.prepare("\n    INSERT INTO products (id, name, code, description, category, status, base_rate, max_ltv, max_dbr, \n    green_dbr, min_term, max_term, gsas_min_score, gsas_premium_score, green_discount_premium,\n    green_discount_standard, ai_confidence_threshold, allow_byop, allow_partner_inventory,\n    required_docs, esg_required_docs, approved_materials, approved_vendors, configuration, created_by, created_at, updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, t.name, t.code || null, t.description || null, t.category || "home_loan", t.status || "draft", t.base_rate || 5.5, t.max_ltv || 90, t.max_dbr || 60, t.green_dbr || 55, t.min_term || 5, t.max_term || 25, t.gsas_min_score || 70, t.gsas_premium_score || 85, t.green_discount_premium || .75, t.green_discount_standard || .5, t.ai_confidence_threshold || 90, (t.allow_byop, 1), (t.allow_partner_inventory, 1), JSON.stringify(t.required_docs || []), JSON.stringify(t.esg_required_docs || []), JSON.stringify(t.approved_materials || []), JSON.stringify(t.approved_vendors || []), JSON.stringify(t.configuration || {}), t.created_by || "u001", r, r).run(), await B(e.env.DB, {
		userId: t.created_by || "u001",
		userName: "Fatima Al-Rashdi",
		userRole: "product_manager",
		action: "PRODUCT_CREATED",
		entityType: "product",
		entityId: n,
		details: { name: t.name }
	}), e.json({
		id: n,
		success: !0
	});
}), V.post("/clone/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();
	if (!r) return e.json({ error: "Source not found" }, 404);
	let i = R("p"), a = z();
	return await e.env.DB.prepare("\n    INSERT INTO products (id, name, code, description, category, status, base_rate, max_ltv, max_dbr,\n    green_dbr, min_term, max_term, min_amount, max_amount, gsas_min_score, gsas_premium_score, \n    green_discount_premium, green_discount_standard, ai_confidence_threshold, allow_byop, allow_partner_inventory,\n    required_docs, esg_required_docs, approved_materials, approved_vendors, configuration, created_by, created_at, updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(i, n.name || r.name + " (Copy)", null, r.description, r.category, "draft", r.base_rate, r.max_ltv, r.max_dbr, r.green_dbr, r.min_term, r.max_term, r.min_amount, r.max_amount, r.gsas_min_score, r.gsas_premium_score, r.green_discount_premium, r.green_discount_standard, r.ai_confidence_threshold, r.allow_byop, r.allow_partner_inventory, r.required_docs, r.esg_required_docs, r.approved_materials, r.approved_vendors, r.configuration, n.user_id || "u001", a, a).run(), await B(e.env.DB, {
		userId: n.user_id || "u001",
		userName: "Fatima Al-Rashdi",
		userRole: "product_manager",
		action: "PRODUCT_CLONED",
		entityType: "product",
		entityId: i,
		details: {
			from_id: t,
			from_name: r.name,
			to_name: n.name
		}
	}), e.json({
		id: i,
		success: !0
	});
}), V.patch("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z(), i = Object.entries(n).filter(([e]) => e !== "user_id" && e !== "user_name").map(([e, t]) => `${e} = ?`).join(", "), a = Object.entries(n).filter(([e]) => e !== "user_id" && e !== "user_name").map(([, e]) => typeof e == "object" ? JSON.stringify(e) : e);
	return i ? (await e.env.DB.prepare(`UPDATE products SET ${i}, updated_at = ? WHERE id = ?`).bind(...a, r, t).run(), await B(e.env.DB, {
		userId: n.user_id || "u001",
		userName: n.user_name || "Fatima Al-Rashdi",
		userRole: "product_manager",
		action: "PRODUCT_CONFIG_UPDATED",
		entityType: "product",
		entityId: t,
		details: n
	}), e.json({ success: !0 })) : e.json({ success: !0 });
}), V.post("/:id/publish", async (e) => {
	let t = e.req.param("id"), n = await e.req.json().catch(() => ({})), r = z(), i = await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();
	if (!i) return e.json({ error: "Not found" }, 404);
	let a = i.name, o = [], s = "", c = e.env.OPENAI_API_KEY;
	if (c) try {
		let e = JSON.parse(i.esg_required_docs || "[]").length > 0, t = `Generate marketing content for a bank loan product. Return JSON only, no markdown:
{"hero_title":"short compelling tagline (max 6 words)","hero_subtitle":"one sentence benefit statement","card_badge":"2-3 word category badge","highlights":["benefit 1","benefit 2","benefit 3","benefit 4"]}
Product: ${i.name}. Description: ${i.description}. Base rate: ${i.base_rate}%.${e ? ` Green discount: up to ${i.green_discount_premium}% for GSAS score ≥${i.gsas_premium_score}. ESG/green product.` : ""}`, n = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${c}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [{
					role: "user",
					content: t
				}],
				temperature: .6,
				max_tokens: 300
			})
		}), r = await n.json();
		if (n.ok) {
			let e = r.choices[0].message.content.match(/\{[\s\S]*\}/);
			if (e) {
				let t = JSON.parse(e[0]);
				a = t.hero_title || a, o = t.highlights || [], s = t.card_badge || "";
			}
		}
	} catch {}
	o.length || (JSON.parse(i.esg_required_docs || "[]").length > 0 ? (o = [
		`Up to ${i.green_discount_premium}% rate discount`,
		"GSAS-certified properties only",
		"Supports Oman Vision 2040",
		"Maker-checker ESG approval"
	], s = "ESG Premium") : o = [
		`From ${i.base_rate}% per annum`,
		`Terms up to ${i.max_term} years`,
		`Up to OMR ${Math.round(i.max_amount / 1e3)}K financing`
	]);
	let l = JSON.parse(i.esg_required_docs || "[]");
	return await e.env.DB.prepare("UPDATE products SET status='active', portal_visible=1, developer_portal_visible=?,\n    portal_hero_title=?, portal_highlights=?, portal_card_badge=?, published_at=?, updated_at=? WHERE id=?").bind(+(l.length > 0), a, JSON.stringify(o), s, r, r, t).run(), await B(e.env.DB, {
		userId: n.user_id || "u001",
		userName: n.user_name || "Fatima Al-Rashdi",
		userRole: "product_manager",
		action: "PRODUCT_PUBLISHED",
		entityType: "product",
		entityId: t,
		details: {
			status: "active",
			portal_visible: !0,
			hero_title: a
		}
	}), e.json({
		success: !0,
		status: "active",
		portal_visible: !0,
		portal_hero_title: a,
		portal_highlights: o
	});
}), V.get("/:id/rules", async (e) => {
	let t = e.req.param("id"), { results: n } = await e.env.DB.prepare("SELECT * FROM rules WHERE product_id = ? OR product_id IS NULL ORDER BY category, name").bind(t).all();
	return e.json({ rules: n });
}), V.post("/:id/rules", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = R("r");
	return await e.env.DB.prepare("\n    INSERT INTO rules (id, product_id, name, category, metric, operator, threshold_value, \n    threshold_condition, action_on_breach, severity, regulatory_reference, source, ai_confidence,\n    description, is_active, created_by, created_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(r, t, n.name, n.category || "general", n.metric, n.operator || "<=", n.threshold_value || null, n.threshold_condition || null, n.action_on_breach || "reject", n.severity || "hard", n.regulatory_reference || null, n.source || "manual", n.ai_confidence || null, n.description || null, 1, n.user_id || "u001", z()).run(), await B(e.env.DB, {
		userId: n.user_id || "u001",
		userName: "Fatima Al-Rashdi",
		userRole: "product_manager",
		action: "RULE_CREATED",
		entityType: "rule",
		entityId: r,
		details: n,
		source: n.source || "manual",
		aiConfidence: n.ai_confidence
	}), e.json({
		id: r,
		success: !0
	});
}), V.patch("/:productId/rules/:ruleId", async (e) => {
	let { productId: t, ruleId: n } = e.req.param(), r = await e.req.json(), i = [
		"name",
		"category",
		"metric",
		"operator",
		"threshold_value",
		"threshold_condition",
		"action_on_breach",
		"severity",
		"regulatory_reference",
		"description",
		"is_active"
	], a = Object.keys(r).filter((e) => i.includes(e));
	if (!a.length) return e.json({ error: "No valid fields" }, 400);
	let o = `UPDATE rules SET ${a.map((e) => `${e}=?`).join(",")} WHERE id=? AND product_id=?`;
	return await e.env.DB.prepare(o).bind(...a.map((e) => r[e]), n, t).run(), await B(e.env.DB, {
		userId: r.user_id || "u001",
		userName: r.user_name || "System",
		userRole: "product_manager",
		action: "RULE_UPDATED",
		entityType: "rule",
		entityId: n,
		details: r
	}), e.json({ success: !0 });
}), V.delete("/:productId/rules/:ruleId", async (e) => {
	let { productId: t, ruleId: n } = e.req.param();
	return await e.env.DB.prepare("DELETE FROM rules WHERE id=? AND product_id=?").bind(n, t).run(), e.json({ success: !0 });
}), V.get("/rule-templates", async (e) => {
	let t = e.req.query("category"), n = "SELECT * FROM rule_templates WHERE 1=1", r = [];
	t && (n += " AND category=?", r.push(t)), n += " ORDER BY category, name";
	let { results: i } = r.length ? await e.env.DB.prepare(n).bind(...r).all() : await e.env.DB.prepare(n).all();
	return e.json({ templates: i });
});
//#endregion
//#region src/api/applications.ts
var H = new P();
H.get("/:id", async (e) => {
	let t = e.req.param("id"), n = t.startsWith("GHL") || t.startsWith("HL"), r = await e.env.DB.prepare(n ? "SELECT a.*, c.name as customer_display_name, c.salary_omr, c.credit_score, c.employer, c.phone, c.email, c.civil_id, c.nationality,\n          p.name as product_name, p.gsas_min_score, p.gsas_premium_score, p.green_discount_premium,\n          p.approved_materials, p.approved_vendors, p.ai_confidence_threshold, p.esg_required_docs,\n          u.unit_number, u.area_sqm, u.bedrooms, u.bathrooms, u.features,\n          pr.name as project_name, pr.developer_id, pr.gsas_score as project_gsas_score\n         FROM applications a\n         LEFT JOIN customers c ON a.customer_id = c.id\n         LEFT JOIN products p ON a.product_id = p.id\n         LEFT JOIN units u ON a.unit_id = u.id\n         LEFT JOIN projects pr ON a.project_id = pr.id\n         WHERE a.reference = ?" : "SELECT a.*, c.name as customer_display_name, c.salary_omr, c.credit_score, c.employer, c.phone, c.email, c.civil_id, c.nationality,\n          p.name as product_name, p.gsas_min_score, p.gsas_premium_score, p.green_discount_premium,\n          p.approved_materials, p.approved_vendors, p.ai_confidence_threshold, p.esg_required_docs,\n          u.unit_number, u.area_sqm, u.bedrooms, u.bathrooms, u.features,\n          pr.name as project_name, pr.developer_id, pr.gsas_score as project_gsas_score\n         FROM applications a\n         LEFT JOIN customers c ON a.customer_id = c.id\n         LEFT JOIN products p ON a.product_id = p.id\n         LEFT JOIN units u ON a.unit_id = u.id\n         LEFT JOIN projects pr ON a.project_id = pr.id\n         WHERE a.id = ?").bind(t).first();
	if (!r) return e.json({ error: "Not found" }, 404);
	let { results: i } = await e.env.DB.prepare("SELECT * FROM documents WHERE entity_type = ? AND entity_id = ?").bind("application", r.id).all(), { results: a } = await e.env.DB.prepare("SELECT * FROM construction_stages WHERE application_id = ? ORDER BY stage_number").bind(r.id).all();
	return e.json({
		application: r,
		documents: i,
		stages: a
	});
}), H.post("/", async (e) => {
	let t = await e.req.json(), n = R("app"), r = z(), i = t.loan_amount || 2e5, a = t.loan_term || 25, o = t.gsas_score || 0, s = 5.5, c = s;
	o >= 85 ? c = 4.75 : o >= 70 && (c = 5);
	let l = c / 100 / 12, u = a * 12, d = i * (l * (1 + l) ** +u) / ((1 + l) ** +u - 1), f = i * (s / 100 / 12 * 1.0045833333333334 ** u) / (1.0045833333333334 ** u - 1), p = (f - d) * u, m = await e.env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(t.customer_id).first(), h = m?.salary_omr || 3200, g = Math.round(d / h * 100), _ = t.property_value || i * 1.25, v = Math.round(i / _ * 100), y = `${t.product_id === "p009" ? "GHL" : "HL"}-${Math.floor(Math.random() * 9e5) + 1e5}`;
	if (await e.env.DB.prepare("\n    INSERT INTO applications (id, reference, product_id, customer_id, customer_name, unit_id, project_id,\n    loan_amount, loan_term, property_address, property_source, property_area_sqm, gsas_score, epc_rating,\n    applied_rate, standard_rate, monthly_payment, standard_monthly_payment, lifetime_saving,\n    dbr, ltv, stress_test_rate, stress_test_passed, malaa_score, status, esg_verification_status,\n    escrow_amount, tracking_url, created_at, updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, y, t.product_id, t.customer_id, m?.name || t.customer_name, t.unit_id || null, t.project_id || null, i, a, t.property_address || "", t.property_source || "partner", t.property_area_sqm || null, o, t.epc_rating || null, c, s, Math.round(d * 100) / 100, Math.round(f * 100) / 100, Math.round(p * 100) / 100, g, v, 9, 1, m?.credit_score || 750, "submitted", "pending", i, `https://sib.om/track/${y}`, r, r).run(), t.product_id === "p009") for (let t of [
		{
			num: 1,
			name: "Foundation & Groundwork",
			desc: "Foundation, groundwork, and underground utilities",
			pct: 25,
			material: "Green Concrete – C30 Grade"
		},
		{
			num: 2,
			name: "Roof & Envelope",
			desc: "Roof structure, external walls, thermal envelope",
			pct: 30,
			material: "Thermal Insulation (R-30+)"
		},
		{
			num: 3,
			name: "MEP & Solar Installation",
			desc: "Mechanical, electrical, plumbing, solar installation",
			pct: 25,
			material: "Solar Panels (min 5kWp)"
		},
		{
			num: 4,
			name: "Finishing & Handover",
			desc: "Interior finishing and final handover",
			pct: 20,
			material: "Energy-Efficient Appliances"
		}
	]) await e.env.DB.prepare("\n        INSERT INTO construction_stages (id, application_id, stage_number, stage_name, description, tranche_amount, tranche_percentage, required_material, status, created_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?)\n      ").bind(R("st"), n, t.num, t.name, t.desc, Math.round(i * t.pct / 100), t.pct, t.material, t.num === 1 ? "active" : "locked", r).run();
	return await B(e.env.DB, {
		userId: t.customer_id || "u020",
		userName: m?.name || "Customer",
		userRole: "customer",
		action: "APPLICATION_SUBMITTED",
		entityType: "application",
		entityId: n,
		details: {
			reference: y,
			amount: i,
			rate: c,
			gsas_score: o
		}
	}), e.json({
		id: n,
		reference: y,
		applied_rate: c,
		monthly_payment: Math.round(d * 100) / 100,
		standard_monthly_payment: Math.round(f * 100) / 100,
		lifetime_saving: Math.round(p * 100) / 100,
		dbr: g,
		ltv: v,
		tracking_url: `https://sib.om/track/${y}`,
		success: !0
	});
}), H.patch("/:id/status", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z(), i = "status = ?, updated_at = ?", a = [n.status, r];
	return n.status === "approved" && n.compliance && (i += ", compliance_approved_by = ?, compliance_approved_at = ?", a.push(n.user_id, r)), n.status === "approved" && n.risk && (i += ", risk_approved_by = ?, risk_approved_at = ?", a.push(n.user_id, r)), n.esg_verification_status && (i += ", esg_verification_status = ?", a.push(n.esg_verification_status)), a.push(t), await e.env.DB.prepare(`UPDATE applications SET ${i} WHERE id = ?`).bind(...a).run(), await B(e.env.DB, {
		userId: n.user_id || "system",
		userName: n.user_name || "System",
		userRole: n.user_role || "system",
		action: "APPLICATION_STATUS_UPDATED",
		entityType: "application",
		entityId: t,
		details: { new_status: n.status }
	}), e.json({ success: !0 });
}), H.post("/calculate", async (e) => {
	let { loan_amount: t, loan_term: n, gsas_score: r, product_id: i } = await e.req.json(), a = (i ? await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(i).first() : null)?.base_rate || 5.5, o = a, s = "Standard Rate";
	r >= 85 ? (o = a - .75, s = "Green Premium (0.75% discount)") : r >= 70 && (o = a - .5, s = "Green Standard (0.5% discount)");
	let c = o / 100 / 12, l = n * 12, u = t * (c * (1 + c) ** +l) / ((1 + c) ** +l - 1), d = a / 100 / 12, f = t * (d * (1 + d) ** +l) / ((1 + d) ** +l - 1);
	return e.json({
		base_rate: a,
		applied_rate: o,
		discount_label: s,
		monthly_payment: Math.round(u * 100) / 100,
		standard_monthly_payment: Math.round(f * 100) / 100,
		monthly_saving: Math.round((f - u) * 100) / 100,
		lifetime_saving: Math.round((f - u) * l * 100) / 100
	});
});
//#endregion
//#region src/api/ai.ts
var U = new P();
U.post("/products/chat", async (e) => {
	let { thread_id: t, message: n, context: r = {}, user_id: i = "u001", user_name: a = "Fatima Al-Rashdi" } = await e.req.json(), o = e.env.OPENAI_API_KEY, s = null, c = [], l = t;
	l && (s = await e.env.DB.prepare("SELECT * FROM ai_threads WHERE id = ?").bind(l).first(), s && (c = JSON.parse(s.messages || "[]"))), (!l || !s) && (l = R("thr"), c = []);
	let { results: u } = await e.env.DB.prepare("SELECT title, content, source FROM knowledge_base ORDER BY category").all(), d = u.map((e) => `[${e.source}] ${e.title}: ${e.content}`).join("\n\n"), { results: f } = await e.env.DB.prepare("SELECT id, name, code, base_rate, max_ltv, max_dbr, max_term FROM products WHERE status = 'active' ORDER BY name").all(), p = `You are a Senior Banking Product Architect at Sohar International Bank, Oman.
You have 20+ years of experience in Islamic and conventional banking product design, CBO regulatory compliance, ESG/green finance, credit risk modelling, and digital banking workflow design.
You are NOT a generic assistant. You are a domain expert who knows exactly what questions to ask, what parameters matter, and what regulators require.
System: jurisdiction Oman, currency OMR, regulator Central Bank of Oman (CBO), rating agency: CBUAE Credit Bureau (Oman), ESG standard: OS GSO 3000:2025.

REGULATORY KNOWLEDGE BASE (cite these precisely):
${d}

EXISTING PRODUCTS IN PORTFOLIO (use real IDs for cloning):
${f.map((e) => `- ${e.name} (ID: ${e.id}): rate ${e.base_rate}%, LTV ${e.max_ltv}%, DBR ${e.max_dbr}%, term ${e.max_term}yr`).join("\n")}

══════════════════════════════════════════════════════════════════
THE 6-STAGE PRODUCT GOVERNANCE PROCESS (PGE):
  Stage 1 – Product Model       : archetype, name, Islamic vs conventional, clone source, target segment, jurisdiction
  Stage 2 – Core Configuration  : pricing (rate, DBR, LTV, terms, amounts), green discount tiers, fees, promotional rates
  Stage 3 – Eligibility Rules   : 10–15 rules covering credit, collateral, ESG, income, nationality, employment
  Stage 4 – Approval Workflow   : 8–12 nodes with external API integrations (eKYC, credit bureau, property valuation, ESG registry)
  Stage 5 – Compliance          : CBO regulatory tags, ECAI risk weights, IFRS9 provisioning, gap analysis, AML flags
  Stage 6 – Simulation          : portfolio modelling, P&L projection, stress test, approval matrix, publish
══════════════════════════════════════════════════════════════════

CONVERSATION RULES — NON-NEGOTIABLE:
1. ONE FOCUSED QUESTION PER TURN. Every single response MUST end with exactly one "?" — no exceptions.
   BANNED: Any response that ends without a "?". If you've confirmed something, immediately pivot to the NEXT sub-question in the same turn.
   BAD: "Great. Conventional structure confirmed. Let's proceed to Stage 2."   ← NO "?" — FORBIDDEN
   GOOD: "Conventional structure confirmed. Next: should this product target Omani nationals only, or include expats too? And what income band — Mass (OMR 800–2K), Affluent (OMR 2K–5K), or HNW (OMR 5K+)?"
   NEVER emit a pure acknowledgement like "Great.", "Understood.", "Noted." without immediately asking the next sub-question in the SAME message.
2. ACT AS THE EXPERT. Don't just ask open questions — give specific recommendations with regulatory citations, then ask the user to confirm or modify.
   BAD: "What interest rate do you want?"
   GOOD: "For a Green Home Loan targeting GSAS-certified properties, I recommend base rate 5.25% (10 bps below Standard Home Loan to incentivise green adoption), with a tiered green discount: 0.75% off for GSAS Score ≥85 (Gold), 0.5% off for Score 70–84 (Silver). Effective floor rate: 4.5%. CBO Circular 2026-12 §3.1 allows this structure. Shall I apply these pricing tiers, or do you want a different spread?"
3. ADVANCE STAGES ONLY ON EXPLICIT USER CONFIRMATION ("yes", "ok", "apply", "go ahead", "proceed", "correct", "sounds good", "use that").
4. WITHIN A STAGE, ask multiple sub-questions if needed before moving on. Don't rush.
5. EMIT UI EVENTS immediately when you apply configuration (not when you're asking). This updates the live product panel on screen.
6. product_draft ONLY at stage 6 (ready_to_confirm). Set null for all prior turns.
7. show_roadmap=true ONLY on Turn 1 when you first identify the product type.
8. current_stage must ONLY increase, never decrease. Track it carefully.
9. STAGE TRANSITIONS: When moving from one stage to the next, combine the "Stage X complete" acknowledgement WITH the first sub-question of Stage X+1 in a SINGLE message. Never send a stage transition without a question at the end.
   BAD: "✅ Stage 1 complete. Moving to Stage 2 — Core Configuration."   ← FORBIDDEN, no "?"
   GOOD: "✅ Stage 1 complete — EcoElite Home Finance, conventional, targeting HNW. <br><br>Stage 2 — Core Configuration. For the base rate: I recommend 5.25% (10 bps below Standard Home Loan). CBO Circular 2026-12 §3.1 permits preferential green pricing. Shall I set 5.25% as the base rate, or adjust?"
10. NEVER repeat a question the user has already answered in this conversation. Check the full message history before asking anything.

STAGE 1 — PRODUCT MODEL (ask these sub-questions in order):
  1a. Clone or scratch? Name the closest existing product and suggest it as a clone source.
  1b. Islamic (Murabaha/Diminishing Musharaka) or Conventional?
  1c. Target segment: Omani nationals only, expats too, or both? Income band (Mass, Affluent >OMR 3,000/mo, HNW)?
  1d. Product name (suggest one, e.g. "Sohar Green Home Finance – GSAS Premium").
  Emit set_field for name and description once confirmed.

STAGE 2 — CORE CONFIGURATION (ask these sub-questions in order):
  2a. Base rate and pricing structure. Give specific recommendation with CBO ceiling reference.
  2b. ESG-specific discount tiers (if green product): GSAS score bands → rate discounts.
  2c. LTV bands: standard vs green (CBO allows up to 90% for green). First home vs non-first.
  2d. DBR: standard 50%, green buffer 55% (CBO Circular 2026-12 §3.2 allows relaxed DBR for green products).
  2e. Term range (min/max years) and amount range (OMR min/max).
  2f. Fees: arrangement fee (suggest 1% capped at OMR 500), early settlement penalty (per CBO rules: 1% max).
  Emit set_field events for each confirmed value.

STAGE 3 — ELIGIBILITY RULES (for Green Home Loan, generate ALL of these):
  First ASK: "I'll now generate 14 eligibility rules covering credit, collateral, ESG, income, nationality and employment. For the GSAS minimum — should I use 70 (Silver, minimum eligibility) or 75 (stricter, premium positioning)?"
  Then on confirmation, emit ALL these rules as add_rule events:

  CREDIT RULES (cite CBO Circular BM/REG/2019/74):
  R1: DBR ≤ 55% (hard) — "max_dbr" — for loan >OMR 100K
  R2: DBR ≤ 60% (hard) — "max_dbr" — for loan ≤OMR 100K  
  R3: Credit Score ≥ 620 (hard) — "credit_score" — Oman Credit Bureau minimum
  R4: No active defaults in 24 months (hard) — "default_history"
  R5: Maximum 3 active credit facilities (soft) — "active_facilities"

  COLLATERAL RULES (cite CBO Circular BM/REG/2019/74):
  R6: LTV ≤ 90% (hard) — "LTV" — first home; ≤80% subsequent
  R7: Property valuation by CBO-approved valuator (hard) — "valuation_approved"
  R8: Title deed must be freehold or 99-year leasehold (hard) — "title_type"
  R9: Property location: Integrated Tourism Circuit (ITC) or Omani ownership zones (hard) — "property_zone"

  ESG RULES (cite OS GSO 3000:2025 and CBO Circular 2026-12):
  R10: GSAS Score ≥ [user-confirmed threshold] (hard) — "gsas_score"
  R11: EPC Rating ≥ C (hard) — "epc_rating" — OEESC minimum
  R12: GSAS Certificate issued by GORD, valid ≥90 days (hard) — "gsas_cert_valid"
  R13: EIA clearance from Environment Authority (hard for projects >20 units) — "eia_approval"
  R14: ESG document set complete: GSAS cert + EPC report + EIA approval (hard) — "esg_docs_complete"

  INCOME/EMPLOYMENT RULES:
  R15: Minimum net monthly income OMR 800 (hard) — "net_income"
  R16: Employment: minimum 6 months at current employer (soft) — "employment_tenure"
  R17: Omani nationals: no restriction. Expats: valid residency ≥ 1 year remaining (hard) — "residency_valid"

STAGE 4 — WORKFLOW (for Green Home Loan, generate all these nodes):
  First ASK: "I'll configure a 10-step approval workflow integrating 4 external data sources. Estimated processing time: 3–5 working days. Should I use automated processing for the first 4 steps (eKYC, credit check, document OCR, property lookup), or do you want more human touchpoints?"
  Then on confirmation, set_workflow with these nodes:

  N1 (start): "Application Submitted via Portal / Branch"
  N2 (task, auto=true, sla_hours=1, role=system): "eKYC & Identity Verification" — desc: "Calls National Centre for Information [NCI] eKYC API to verify Civil ID biometrics. AML screening via WorldCheck/Refinitiv. Result: identity_verified=true/false."
  N3 (task, auto=true, sla_hours=4, role=system): "CBO Credit Bureau Check" — desc: "Calls Oman Credit Bureau API. Retrieves credit score, active facilities count, default history. Auto-rejects if score <620 or default in 24 months."
  N4 (task, auto=true, sla_hours=2, role=system): "Document OCR & Extraction" — desc: "AI OCR extracts fields from: salary cert, civil ID, GSAS certificate, EPC report, EIA approval. Validates formats against product schema."
  N5 (task, auto=true, sla_hours=8, role=system): "GSAS Registry Verification" — desc: "Calls GORD (Gulf Organisation for Research & Development) GSAS API. Validates certificate number, issuer, score, rating, expiry. Confirms property matches submitted certificate."
  N6 (task, auto=true, sla_hours=4, role=system): "Property Valuation & Title Check" — desc: "Integrates with approved valuation firms API (Al Mashora, JLL Oman) for drive-by or desktop valuation. Calls Muscat Municipality / MRMEWR for title deed verification. Confirms ITC/ownership zone eligibility."
  N7 (approval, sla_hours=24, role=credit_analyst): "Credit Underwriting" — desc: "Credit analyst reviews full application: income verification vs salary cert, DBR calculation, stress test at +2% rate, LTV confirmation. Uses bank's internal credit scoring model."
  N8 (approval, sla_hours=24, role=green_finance_officer): "ESG Compliance Review" — desc: "Dedicated Green Finance Officer validates: GSAS score vs product threshold, EPC rating band (A/B/C), EIA coverage matches property units, approved materials list for construction-stage disbursement. Determines discount tier (0.75% or 0.5%)."
  N9 (approval, sla_hours=48, role=risk_officer): "Risk & Compliance Approval" — desc: "Risk Officer signs off: concentration risk check, IFRS9 staging (Stage 1 expected), regulatory capital adequacy (risk weight 75%), AML/CFT secondary review."
  N10 (approval, sla_hours=24, role=product_manager): "Product Manager Final Approval" — desc: "PM confirms product terms match approved configuration. Validates green discount applied correctly. Issues Letter of Offer."
  N11 (end): "Decision & Letter of Offer Issued"

STAGE 5 — COMPLIANCE (ask then apply):
  First ASK: "For compliance classification: I recommend tagging this as Basel III risk weight 75% (residential retail mortgage, LTV ≤90%), IFRS9 Stage 1 provisioning at 1.5% (higher than standard 1.0% due to ESG concentration), and CBO green finance classification. The AML risk score is LOW given eKYC + credit bureau auto-verification. Shall I apply these parameters?"
  Then emit ui_events set_field for:
  - risk_weight: 75%
  - provisioning_rate: 1.5%
  - regulatory_tags: ["#CLIMATE_RISK", "#ESG_ELIGIBILITY", "#GREEN_FINANCING", "#OMAN_VISION_2040"]
  - aml_risk: "LOW"
  - cbo_classification: "GREEN_FINANCE"
  - capital_treatment: "RETAIL_RESIDENTIAL_MORTGAGE"

STAGE 6 — SIMULATION (this turn: emit full product_draft + rules_draft + schema_draft):
  Provide real portfolio projections:
  - Portfolio target: 500 accounts, OMR 150M in first 24 months
  - Revenue model: NIM ~1.8% on green rate (vs 2.2% standard), offset by 0.4% lower provisioning + 10 bps CBO green capital relief
  - Stress test: portfolio performs at 100% pass rate if rates increase by 200 bps (DBR ≤55% built-in buffer)
  - Break-even: month 14 after launch
  - CBO reporting: monthly ESG portfolio report under Circular 2026-12 §7

UI EVENTS — emit immediately when you apply something:
- { type: "set_tab", tab: "general"|"pricing"|"eligibility"|"workflow"|"ai_config" }
- { type: "set_field", field: "name"|"description"|"base_rate"|"max_ltv"|"max_dbr"|"max_term"|"min_amount"|"max_amount"|"gsas_min_score"|"gsas_premium_score"|"green_discount_premium"|"green_discount_standard", value: any }
- { type: "add_rule", rule: { name, category, metric, operator, threshold_value, severity, regulatory_reference, ai_confidence, description } }
- { type: "set_workflow", nodes: [{id, type, label, role, sla_hours, auto, description}] }
- { type: "highlight_field", field: string }

RESPONSE FORMAT — ONLY valid JSON, NO markdown, NO code fences:
{
  "message": "Expert reply with specifics, recommendations, regulatory citations — ends with one focused question (?)",
  "current_stage": 1,
  "show_roadmap": false,
  "action": "none",
  "ui_events": [],
  "product_draft": null,
  "rules_draft": null,
  "schema_draft": null
}`, m = {
		role: "user",
		content: n,
		timestamp: z()
	};
	c.push(m);
	let h = {
		message: "I'll help you configure this product.",
		current_stage: 1,
		show_roadmap: !1,
		action: "none",
		ui_events: [],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (o) try {
		let e = [{
			role: "system",
			content: p
		}, ...c.map((e) => ({
			role: e.role,
			content: e.content
		}))], t = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${o}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "gpt-4o",
				messages: e,
				temperature: .3,
				max_tokens: 1500
			})
		}), n = await t.json();
		if (t.ok) {
			let e = n.choices[0].message.content, t = e.match(/\{[\s\S]*\}/);
			if (t) {
				h = JSON.parse(t[0]), h.current_stage < 6 && (h.product_draft = null), h.current_stage < 3 && (h.rules_draft = null), h.current_stage >= 6 && (h.rules_draft = null), h.current_stage > 1 && (h.show_roadmap = !1);
				let e = h.message || "", n = /how would you like to proceed\?/i.test(e), r = h.current_stage || 1, i = {
					1: "Type <strong>yes</strong> to confirm this product model, or let me know what to adjust.",
					2: "Type <strong>yes</strong> to confirm these parameters, or tell me which values to change.",
					3: "Type <strong>yes</strong> to generate the eligibility rules, or adjust the GSAS threshold.",
					4: "Type <strong>yes</strong> to confirm the workflow, or tell me if you want more human touchpoints.",
					5: "Type <strong>yes</strong> to apply these compliance parameters, or request adjustments.",
					6: "Click <strong>Confirm &amp; Publish</strong> above to save and publish the product."
				};
				n && (h.message = e.replace(/how would you like to proceed\?/i, "").replace(/\s+$/, "") + (e.replace(/how would you like to proceed\?/i, "").trim() ? "<br><br>" : "") + "<em style=\"font-size:.8rem;color:rgba(255,255,255,.55)\">" + (i[r] || "Reply to continue.") + "</em>");
				let a = h.message || "", o = a.includes("?"), s = !o && (/stage \d+ complete/i.test(a) || /let'?s (proceed|move on|move to|configure|set up)/i.test(a) || /we('ll| will) (proceed|move|configure|set)/i.test(a) || /moving (on|to) stage/i.test(a) || /^(great|noted|understood|confirmed|perfect)\b.{0,120}$/i.test(a.replace(/<[^>]+>/g, "")));
				!o && !n && h.action !== "ready_to_confirm" && (s ? h.message = a + "<br><br><em style=\"font-size:.8rem;color:rgba(255,255,255,.55)\">Reply to continue.</em>" : h.message = a + "<br><br><em style=\"font-size:.8rem;color:rgba(255,255,255,.55)\">" + (i[r] || "Reply to continue.") + "</em>");
			} else h.message = e;
		}
	} catch {
		h = Ge(n, c.length, c);
	}
	else h = Ge(n, c.length, c);
	let g = {
		role: "assistant",
		content: h.message,
		timestamp: z(),
		metadata: { action: h.action }
	};
	c.push(g);
	let _ = z(), v = {};
	if (s?.result) try {
		v = JSON.parse(s.result);
	} catch {
		v = {};
	}
	return h.product_draft && (v.product_draft = h.product_draft), h.rules_draft && (v.rules_draft = h.rules_draft), h.schema_draft && (v.schema_draft = h.schema_draft), await e.env.DB.prepare("\n    INSERT INTO ai_threads (id, user_id, purpose, messages, context, status, result, created_at, updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?)\n    ON CONFLICT(id) DO UPDATE SET messages=excluded.messages, result=excluded.result, updated_at=excluded.updated_at\n  ").bind(l, i, r.purpose || "product_creation", JSON.stringify(c), JSON.stringify(r), "active", JSON.stringify(v), _, _).run(), e.json({
		thread_id: l,
		reply: h.message,
		current_stage: h.current_stage || 1,
		show_roadmap: h.show_roadmap || !1,
		action: h.action || "none",
		ui_events: h.ui_events || [],
		product_draft: h.product_draft || null,
		rules_draft: h.rules_draft || null,
		schema_draft: h.schema_draft || null
	});
}), U.post("/products/confirm", async (e) => {
	let { thread_id: t, product_draft: n, rules_draft: r, schema_draft: i, user_id: a = "u001", user_name: o = "Fatima Al-Rashdi" } = await e.req.json();
	if (t) {
		let a = await e.env.DB.prepare("SELECT result FROM ai_threads WHERE id = ?").bind(t).first();
		if (a?.result) try {
			let e = JSON.parse(a.result);
			!n && e.product_draft && (n = e.product_draft), !r && e.rules_draft && (r = e.rules_draft), !i && e.schema_draft && (i = e.schema_draft);
		} catch {}
	}
	if (!n) return e.json({
		success: !1,
		error: "No product draft found. Please complete the AI conversation first."
	}, 400);
	let s = R("p"), c = z(), l = {};
	i && (l.gsas_schema = i);
	let u = n.clone_from_id ? await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(n.clone_from_id).first() : null, d = n.name || "Green Home Loan – ESG", f = `GHL-${Date.now().toString(36).toUpperCase()}`;
	await e.env.DB.prepare("\n    INSERT INTO products (id, name, code, description, category, status, base_rate, max_ltv, max_dbr,\n    green_dbr, min_term, max_term, min_amount, max_amount,\n    gsas_min_score, gsas_premium_score, green_discount_premium, green_discount_standard,\n    ai_confidence_threshold, allow_byop, allow_partner_inventory,\n    required_docs, esg_required_docs, approved_materials, approved_vendors,\n    configuration, portal_visible, developer_portal_visible, pge_stage, created_by, created_at, updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(s, d, f, n.description || u?.description || "", n.category || "home_loan", "draft", n.base_rate || u?.base_rate || 5.5, n.max_ltv || u?.max_ltv || 90, n.max_dbr || u?.max_dbr || 60, n.green_dbr || 55, n.min_term || u?.min_term || 5, n.max_term || u?.max_term || 25, n.min_amount || u?.min_amount || 1e4, n.max_amount || u?.max_amount || 5e5, n.gsas_min_score || 70, n.gsas_premium_score || 85, n.green_discount_premium || .75, n.green_discount_standard || .5, 90, 1, 1, JSON.stringify(n.required_docs || (u ? JSON.parse(u.required_docs || "[]") : [
		"salary_cert",
		"civil_id",
		"property_deed",
		"valuation_report",
		"utility_bill"
	])), JSON.stringify(n.esg_required_docs || [
		"gsas_cert",
		"epc_report",
		"eia_approval"
	]), JSON.stringify(n.approved_materials || [
		"Green Concrete",
		"Thermal Insulation",
		"Solar Panels",
		"Energy-Efficient Appliances",
		"Low-E Glass",
		"Recycled Steel"
	]), JSON.stringify(n.approved_vendors || [
		"Oman Readymix LLC",
		"Gulf Insulation Group",
		"SunTech Oman",
		"Green Build Oman",
		"EcoMaterials Oman"
	]), JSON.stringify(l), 0, 0, 1, a, c, c).run();
	let p = [];
	if (r && Array.isArray(r)) for (let t of r) {
		let n = R("r");
		await e.env.DB.prepare("\n        INSERT INTO rules (id, product_id, name, category, metric, operator, threshold_value,\n        threshold_condition, action_on_breach, severity, regulatory_reference, source,\n        ai_confidence, description, is_active, created_by, created_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n      ").bind(n, s, t.name, t.category, t.metric, t.operator, t.threshold_value || null, t.threshold_condition || null, t.action_on_breach || "reject", t.severity || "hard", t.regulatory_reference || null, "ai_generated", t.ai_confidence || null, t.description || null, 1, a, c).run(), p.push(n);
	}
	let m = e.env.OPENAI_API_KEY, h = d, g = [], _ = "", v = (n.esg_required_docs || []).length > 0;
	if (m) try {
		let e = `Generate marketing content for a bank loan product. Return JSON only, no markdown:
{"hero_title":"short compelling tagline (max 6 words)","hero_subtitle":"one sentence benefit statement","card_badge":"2-3 word category badge","highlights":["benefit 1","benefit 2","benefit 3","benefit 4"]}
Product: ${d}. Description: ${n.description || ""}. Base rate: ${n.base_rate || 5.5}%.${v ? ` Green discount: up to ${n.green_discount_premium || .75}% for GSAS score ≥${n.gsas_premium_score || 85}. ESG/green product.` : ""}`, t = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${m}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [{
					role: "user",
					content: e
				}],
				temperature: .6,
				max_tokens: 300
			})
		}), r = await t.json();
		if (t.ok) {
			let e = r.choices[0].message.content.match(/\{[\s\S]*\}/);
			if (e) {
				let t = JSON.parse(e[0]);
				h = t.hero_title || h, g = t.highlights || [], _ = t.card_badge || "";
			}
		}
	} catch {}
	g.length || (v ? (g = [
		`Up to ${n.green_discount_premium || .75}% rate discount`,
		"GSAS-certified properties only",
		"Supports Oman Vision 2040",
		"Maker-checker ESG approval"
	], _ = "ESG Premium") : g = [
		`From ${n.base_rate || 5.5}% per annum`,
		`Terms up to ${n.max_term || 25} years`,
		`Up to OMR ${Math.round((n.max_amount || 5e5) / 1e3)}K financing`
	]);
	let y = p.length > 0 ? 6 : 1;
	return await e.env.DB.prepare("UPDATE products SET status='active', portal_visible=1, developer_portal_visible=?,\n     portal_hero_title=?, portal_highlights=?, portal_card_badge=?, published_at=?, pge_stage=?, updated_at=? WHERE id=?").bind(+!!v, h, JSON.stringify(g), _, c, y, c, s).run(), t && await e.env.DB.prepare("UPDATE ai_threads SET status='completed', product_id=?, result=?, updated_at=? WHERE id=?").bind(s, JSON.stringify({
		product_id: s,
		rule_ids: p
	}), c, t).run(), await B(e.env.DB, {
		userId: a,
		userName: o,
		userRole: "product_manager",
		action: "PRODUCT_CREATED_BY_AI",
		entityType: "product",
		entityId: s,
		details: {
			name: d,
			rules_created: p.length,
			cloned_from: n.clone_from_id || null,
			thread_id: t,
			portal_visible: !0
		},
		source: "ai_generated"
	}), e.json({
		success: !0,
		product_id: s,
		product_name: d,
		rule_ids: p,
		portal_hero_title: h,
		portal_visible: !0
	});
}), U.post("/rules/generate", async (e) => {
	let { text: t, product_id: n, user_id: r = "u001", user_name: i = "Fatima Al-Rashdi" } = await e.req.json(), a = e.env.OPENAI_API_KEY;
	try {
		let o = await callOpenAI(t, "You are a banking regulatory compliance AI for Sohar International Bank in Oman. \nYou extract regulatory rules from regulatory text and convert them to structured JSON rule definitions.\nReturn ONLY valid JSON matching this schema:\n{\n  \"rules\": [{\n    \"name\": \"string\",\n    \"category\": \"creditworthiness|collateral|product|esg|compliance|stress_test|eligibility\",\n    \"metric\": \"string (e.g. DBR, LTV, credit_score, gsas_score)\",\n    \"operator\": \"<=|>=|=|in|between\",\n    \"threshold_value\": number or null,\n    \"threshold_condition\": \"string or null (for conditional rules)\",\n    \"action_on_breach\": \"reject|flag|warning\",\n    \"severity\": \"hard|soft\",\n    \"description\": \"string\",\n    \"regulatory_reference\": \"string\",\n    \"ai_confidence\": number (0-100)\n  }],\n  \"related_regulations\": [{\"title\": \"string\", \"reference\": \"string\", \"relevance\": \"string\"}],\n  \"analysis_summary\": \"string\"\n}", a, "gpt-4o"), s;
		try {
			let e = o.match(/\{[\s\S]*\}/);
			s = JSON.parse(e ? e[0] : o);
		} catch {
			s = {
				rules: [],
				related_regulations: [],
				analysis_summary: o
			};
		}
		if (s.rules && n) for (let t of s.rules) {
			let i = R("r");
			await e.env.DB.prepare("\n          INSERT INTO rules (id, product_id, name, category, metric, operator, threshold_value, threshold_condition,\n          action_on_breach, severity, regulatory_reference, source, ai_confidence, description, is_active, created_by, created_at)\n          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n        ").bind(i, n, t.name, t.category, t.metric, t.operator, t.threshold_value || null, t.threshold_condition || null, t.action_on_breach, t.severity, t.regulatory_reference, "ai_generated", t.ai_confidence, t.description, 0, r, z()).run();
		}
		return await B(e.env.DB, {
			userId: r,
			userName: i,
			userRole: "product_manager",
			action: "AI_RULE_GENERATED",
			entityType: "rule",
			entityId: n,
			details: {
				prompt: t.substring(0, 200),
				rules_count: s.rules?.length || 0
			},
			source: "ai_generated",
			aiConfidence: s.rules?.[0]?.ai_confidence
		}), e.json(s);
	} catch {
		return e.json(He(t));
	}
}), U.post("/documents/validate", async (e) => {
	let { doc_type: t, extracted_text: n, entity_id: r, entity_type: i = "project", user_id: a = "system" } = await e.req.json(), o = e.env.OPENAI_API_KEY, s = Ue(t);
	try {
		let r = `Document type: ${t}\nExtracted text: ${n || "N/A (using demo mode)"}`, i = await callOpenAI(r, "You are an AI document validation system for Sohar International Bank's Green Home Loan program.\nValidate the provided document against Oman banking and ESG regulatory standards.\nReturn ONLY valid JSON:\n{\n  \"doc_type\": \"gsas_cert|epc_report|eia_approval|civil_id|salary_cert|invoice\",\n  \"extracted_fields\": {},\n  \"validation_results\": [{\"field\": \"string\", \"value\": \"string\", \"status\": \"pass|fail|warning\", \"message\": \"string\"}],\n  \"overall_status\": \"auto_verified|manual_review|rejected\",\n  \"ai_confidence\": number (0-100),\n  \"confidence_reason\": \"string\",\n  \"recommendation\": \"string\"\n}", o, "gpt-4o"), a;
		try {
			let e = i.match(/\{[\s\S]*\}/);
			a = JSON.parse(e ? e[0] : i);
		} catch {
			a = s;
		}
		return e.json(a);
	} catch {
		return e.json(s);
	}
}), U.post("/reports/generate", async (e) => {
	let { prompt: t, data: n, report_type: r = "compliance", user_id: i = "u002" } = await e.req.json(), a = e.env.OPENAI_API_KEY, { results: o } = await e.env.DB.prepare("SELECT a.*, c.name as customer_name, c.credit_score FROM applications a\n     LEFT JOIN customers c ON a.customer_id = c.id\n     WHERE a.product_id = 'p009' ORDER BY a.created_at DESC LIMIT 20").all();
	try {
		let n = JSON.stringify({
			applications: o.slice(0, 5),
			prompt: t
		}), r = await callOpenAI(n, "You are a compliance reporting AI for Sohar International Bank.\nGenerate a professional compliance report in JSON format:\n{\n  \"title\": \"string\",\n  \"period\": \"string\",\n  \"summary\": {\"total_applications\": number, \"approved\": number, \"rejected\": number, \"pending\": number, \"avg_gsas_score\": number, \"approval_rate\": \"string\"},\n  \"sections\": [{\"heading\": \"string\", \"content\": \"string\"}],\n  \"flagged_items\": [{\"application_ref\": \"string\", \"issue\": \"string\", \"recommendation\": \"string\"}],\n  \"metrics\": [{\"label\": \"string\", \"value\": \"string\", \"status\": \"green|amber|red\"}]\n}", a, "gpt-4o"), i;
		try {
			let e = r.match(/\{[\s\S]*\}/);
			i = JSON.parse(e ? e[0] : r);
		} catch {
			i = We(o);
		}
		return e.json(i);
	} catch {
		return e.json(We(o));
	}
}), U.post("/invoice/validate", async (e) => {
	let { filename: t, application_id: n } = await e.req.json(), r = await e.env.DB.prepare("SELECT p.approved_materials, p.approved_vendors FROM applications a JOIN products p ON a.product_id = p.id WHERE a.id = ?").bind(n).first();
	return r && JSON.parse(r.approved_materials || "[]"), r && JSON.parse(r.approved_vendors || "[]"), e.json({
		ocr_extracted: {
			material: "Green Concrete – C30 Grade",
			total_amount: "OMR 12,000",
			supplier: "Oman Readymix LLC",
			invoice_date: "2026-08-28",
			invoice_number: "INV-2026-08-4471"
		},
		validation_results: [
			{
				check: "Material Classification",
				result: "Green Concrete – C30 Grade",
				status: "pass",
				icon: "✅",
				detail: "Approved green material"
			},
			{
				check: "Supplier Verification",
				result: "Oman Readymix LLC",
				status: "pass",
				icon: "✅",
				detail: "Pre-approved vendor"
			},
			{
				check: "Amount Validation",
				result: "OMR 12,000",
				status: "pass",
				icon: "✅",
				detail: "Within expected range"
			},
			{
				check: "Invoice Date",
				result: "2026-08-28",
				status: "pass",
				icon: "✅",
				detail: "Valid invoice date"
			}
		],
		overall_status: "auto_verified",
		ai_confidence: 94,
		recommendation: "Stage 1 completion verified. Green material confirmed. Payment authorised."
	});
}), U.post("/schema/generate", async (e) => (await e.req.json(), e.json({
	schema_type: "gsas_certificate_validation",
	fields: [
		{
			name: "Certificate Number",
			type: "String",
			validation: "^GSAS-\\d{4}-\\d{3}$",
			error_message: "Invalid certificate number format"
		},
		{
			name: "Issuer",
			type: "String",
			validation: "Must be \"GORD\" or accredited body",
			error_message: "Issuer not accredited"
		},
		{
			name: "Issue Date",
			type: "Date",
			validation: "Must be ≤ today",
			error_message: "Certificate not yet issued"
		},
		{
			name: "Expiry Date",
			type: "Date",
			validation: "Must be ≥ today + 90 days",
			error_message: "Certificate expires within 90 days"
		},
		{
			name: "Overall Score",
			type: "Integer",
			validation: "0-100, min 70 for eligibility",
			error_message: "Score below minimum threshold (70)"
		},
		{
			name: "Rating",
			type: "String",
			validation: "Must be Silver/Gold/Platinum (Bronze rejected)",
			error_message: "Rating does not meet minimum"
		}
	],
	ai_confidence: 96,
	regulatory_reference: "OS GSO 3000:2025, Section 4.2"
})));
function He(e) {
	let t = e.toLowerCase().includes("dbr") || e.toLowerCase().includes("debt burden");
	return e.toLowerCase().includes("gsas") || e.toLowerCase().includes("green"), t ? {
		rules: [{
			name: "Green DBR Buffer Rule",
			category: "creditworthiness",
			metric: "DBR",
			operator: "<=",
			threshold_value: 55,
			threshold_condition: "loan_amount > 100000",
			action_on_breach: "reject",
			severity: "hard",
			description: "For green financing with loan >OMR 100,000: DBR ≤ 55%. For ≤OMR 100,000: DBR ≤ 60%.",
			regulatory_reference: "CBO Circular 2026-12, Section 3.2",
			ai_confidence: 94
		}],
		related_regulations: [
			{
				title: "GSAS Certification Required",
				reference: "OS GSO 3000:2025, Section 4.2",
				relevance: "GSAS certificate required for green products"
			},
			{
				title: "EPC Rating Minimum",
				reference: "OEESC, Section 5.1",
				relevance: "EPC rating minimum C for energy efficiency incentives"
			},
			{
				title: "EIA Clearance",
				reference: "Environment Authority Decision 107/2023",
				relevance: "EIA clearance required for >20 residential units"
			}
		],
		analysis_summary: "Extracted DBR threshold of 55% for green products (60% minus 5% buffer). Identified 3 related ESG regulations."
	} : {
		rules: [{
			name: "GSAS Score Minimum Threshold",
			category: "esg",
			metric: "gsas_score",
			operator: ">=",
			threshold_value: 70,
			action_on_breach: "reject",
			severity: "hard",
			description: "Property must achieve minimum GSAS score of 70 for Green Home Loan eligibility.",
			regulatory_reference: "OS GSO 3000:2025, Section 4.2",
			ai_confidence: 96
		}],
		related_regulations: [],
		analysis_summary: "Extracted GSAS score threshold and certification requirements."
	};
}
function Ue(e) {
	let t = {
		gsas_cert: {
			doc_type: "gsas_cert",
			extracted_fields: {
				certificate_number: "GSAS-2026-078",
				issuer: "GORD (Gulf Organisation for Research & Development)",
				issue_date: "2026-02-15",
				expiry_date: "2028-12-31",
				overall_score: 89,
				rating: "Gold",
				property: "EcoVillage Muscat"
			},
			validation_results: [
				{
					field: "Certificate Number",
					value: "GSAS-2026-078",
					status: "pass",
					message: "Valid format"
				},
				{
					field: "Issuer",
					value: "GORD",
					status: "pass",
					message: "Accredited issuer"
				},
				{
					field: "Expiry Date",
					value: "2028-12-31",
					status: "pass",
					message: "Valid for 2+ years"
				},
				{
					field: "Overall Score",
					value: "89",
					status: "pass",
					message: "Exceeds minimum (70). Premium tier (≥85): 0.75% discount applies"
				},
				{
					field: "Rating",
					value: "Gold",
					status: "pass",
					message: "Gold rating meets requirements"
				}
			],
			overall_status: "auto_verified",
			ai_confidence: 96,
			confidence_reason: "High-quality document scan, all required fields clearly visible",
			recommendation: "Auto-Verified. GSAS score 89 qualifies for premium Green discount (0.75%)."
		},
		epc_report: {
			doc_type: "epc_report",
			extracted_fields: {
				rating: "A",
				expiry_date: "2027-05-01",
				property_ref: "EVM-B1",
				energy_consumption: "85 kWh/m²/year",
				co2_rating: "A",
				assessor: "Green Build Oman"
			},
			validation_results: [
				{
					field: "EPC Rating",
					value: "A",
					status: "pass",
					message: "Exceeds minimum (C required)"
				},
				{
					field: "Expiry Date",
					value: "2027-05-01",
					status: "pass",
					message: "Valid until May 2027"
				},
				{
					field: "Assessor",
					value: "Green Build Oman",
					status: "pass",
					message: "OEESC accredited assessor"
				},
				{
					field: "Document Quality",
					value: "88%",
					status: "warning",
					message: "Slight image skew detected"
				}
			],
			overall_status: "manual_review",
			ai_confidence: 88,
			confidence_reason: "Slight image skew reduced extraction confidence below 90% threshold",
			recommendation: "Manual Review Recommended. Rating A confirmed; expiry 2027 acceptable. Quick visual verification advised."
		},
		eia_approval: {
			doc_type: "eia_approval",
			extracted_fields: {
				reference: "EIA/2026/442",
				issuer: "Environment Authority",
				approval_date: "2026-03-10",
				valid_until: "2029-03-10",
				project: "EcoVillage Muscat",
				units: 24,
				status: "Approved"
			},
			validation_results: [
				{
					field: "Reference Number",
					value: "EIA/2026/442",
					status: "pass",
					message: "Valid EIA reference format"
				},
				{
					field: "Issuer",
					value: "Environment Authority",
					status: "pass",
					message: "Official issuing body"
				},
				{
					field: "Validity",
					value: "2029-03-10",
					status: "pass",
					message: "Valid for 3+ years"
				},
				{
					field: "Units Coverage",
					value: "24 units",
					status: "pass",
					message: "Covers all 24 project units"
				}
			],
			overall_status: "auto_verified",
			ai_confidence: 95,
			confidence_reason: "Clear document, all required fields extracted with high confidence",
			recommendation: "Auto-Verified. EIA clearance confirmed for all 24 units."
		}
	};
	return t[e] || t.gsas_cert;
}
function We(e) {
	return {
		title: "Green Home Loan – ESG Compliance Report",
		period: "August 2026",
		summary: {
			total_applications: e.length || 3,
			approved: 1,
			rejected: 0,
			pending: 2,
			avg_gsas_score: 89,
			approval_rate: "33%"
		},
		sections: [
			{
				heading: "Executive Summary",
				content: "Green Home Loan program launched 31 August 2026. Current pipeline shows strong ESG compliance with average GSAS score of 89 across active applications."
			},
			{
				heading: "ESG Verification Summary",
				content: "All submitted applications include valid GSAS certificates. One EPC document required manual override due to image quality (88% AI confidence). All EIA clearances auto-verified."
			},
			{
				heading: "Credit Risk Analysis",
				content: "Average DBR across approved applications: 48% (CBO limit: 55% for green products). All applications passed CBO stress test at simulated 9% rate."
			}
		],
		flagged_items: [{
			application_ref: "GHL-250001",
			issue: "EPC confidence below threshold (88%)",
			recommendation: "Manual verification completed by Aisha Al-Balushi. Approved."
		}],
		metrics: [
			{
				label: "Average GSAS Score",
				value: "89",
				status: "green"
			},
			{
				label: "Average DBR",
				value: "48%",
				status: "green"
			},
			{
				label: "Average LTV",
				value: "80%",
				status: "green"
			},
			{
				label: "ESG Auto-Verification Rate",
				value: "67%",
				status: "amber"
			},
			{
				label: "CBO Stress Test Pass Rate",
				value: "100%",
				status: "green"
			}
		]
	};
}
function Ge(e, t, n) {
	let r = e.toLowerCase(), i = r.includes("yes") || r.includes("ok") || r.includes("proceed") || r.includes("confirm") || r.includes("clone") || r.includes("standard") || r.includes("agree") || r.includes("sounds good") || r.includes("go ahead") || r.includes("correct") || r.includes("apply") || r.includes("sure") || r.includes("fine") || r.includes("good") || r.includes("perfect") || r.includes("great") || r.includes("continue") || r.includes("use") || r.includes("keep") || r.includes("proceed"), a = n || [], o = a.filter((e) => e.role === "assistant").map((e) => (e.content || "").toLowerCase()), s = o.some((e) => e.includes("clone") || e.includes("from scratch") || e.includes("product model") || e.includes("stage 1")), c = o.some((e) => e.includes("islamic") || e.includes("murabaha") || e.includes("conventional") || e.includes("structure")), l = o.some((e) => e.includes("target segment") || e.includes("omani nationals") || e.includes("expat") || e.includes("income band")), u = o.some((e) => e.includes("product name") || e.includes("sohar green") || e.includes("sohar eco") || e.includes("ecohome") || e.includes("confirm the name") || e.includes("shall i use") || e.includes("for the product name") || e.includes("i suggest") && e.includes("name")), d = o.some((e) => e.includes("base rate") || e.includes("pricing structure") || e.includes("stage 2") || e.includes("5.25%")), f = o.some((e) => e.includes("discount tier") || e.includes("green discount") || e.includes("gsas score band")), p = o.some((e) => e.includes("ltv band") || e.includes("loan-to-value") || e.includes("ltv") && e.includes("first home") && e.includes("subsequent") || e.includes("90% ltv") || e.includes("ltv settings")), m = o.some((e) => e.includes("dbr") && (e.includes("55%") || e.includes("stage 2") || e.includes("debt burden"))), h = o.some((e) => e.includes("term range") || e.includes("amount range") || e.includes("omr 10,000") || e.includes("min/max")), g = o.some((e) => e.includes("arrangement fee") || e.includes("early settlement") || e.includes("fee")), _ = o.some((e) => e.includes("17 eligibility rules") || e.includes("gsas minimum") || e.includes("stage 3") && e.includes("credit risk")), v = o.some((e) => e.includes("10-step workflow") || e.includes("10-step approval workflow") || e.includes("more human touchpoints in the automated phase") || e.includes("should i configure automated processing")), y = o.some((e) => e.includes("stage 4 complete") || e.includes("10-step approval workflow configured") || e.includes("approval workflow set") || e.includes("approval workflow configured") || e.includes("workflow is now configured") || e.includes("workflow has been configured") || e.includes("nci ekyc") && e.includes("muscat municipality") || e.includes("workflow") && e.includes("10 steps") || e.includes("workflow") && e.includes("10-step") && e.includes("stage 5")), b = o.some((e) => e.includes("shall i apply these compliance parameters") || e.includes("compliance parameters, or do you want to adjust") || e.includes("stage 5 complete") || e.includes("compliance parameters applied") || e.includes("basel iii") && e.includes("ifrs9") && e.includes("aml risk score")), x = o.some((e) => e.includes("ready to publish") || e.includes("confirm &amp; publish") || e.includes("confirm & publish") || e.includes("click confirm") || e.includes("stage 6") && (e.includes("portfolio target") || e.includes("break-even") || e.includes("nim ~")) || e.includes("stage 6") && e.includes("everything is configured")), S = [...a.map((e) => e.content || ""), e].join(" ").toLowerCase(), C = S.includes("green") || S.includes("gsas") || S.includes("esg") || S.includes("sustainable"), w = !C && (S.includes("auto") || S.includes("car") || S.includes("vehicle")), T = !C && !w && (S.includes("personal") || S.includes("unsecured") || S.includes("consumer")), E = !C && !w && !T && (S.includes("sme") || S.includes("business") || S.includes("working capital")), D = (() => {
		let e = r.match(/\b(7[0-9]|80|85|90)\b/);
		return e ? parseInt(e[1]) : 70;
	})(), O = C ? "Sohar Green Home Finance – GSAS" : w ? "Auto Finance" : T ? "Personal Finance" : E ? "SME Working Capital" : "Home Finance";
	if (!s && !C && !w && !T && !E) return {
		message: "I can help you create a new fully-regulated banking product from scratch — I'll guide you through all 6 stages, ask the right expert questions, and automatically populate the configuration on screen.<br><br><strong>What type of product would you like to create?</strong><br><br>🏠 <strong>Green Home Loan</strong> (GSAS/ESG-certified mortgages)<br>🏠 <strong>Standard Home Loan</strong> (conventional or Islamic Murabaha)<br>🚗 <strong>Auto Finance</strong> (personal or fleet)<br>💳 <strong>Personal Finance</strong> (salary-backed unsecured)<br>🏢 <strong>SME Finance</strong> (working capital, equipment, trade)<br>🎓 <strong>Education Finance</strong><br>🏗️ <strong>Commercial Real Estate</strong>",
		current_stage: 0,
		show_roadmap: !1,
		action: "none",
		ui_events: [],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (!s) {
		let e = C ? "Standard Home Loan (5.5% base, LTV 90%, DBR 60%, term 25yr)" : w ? "Auto Finance – Personal (6.5% base, LTV 80%, DBR 55%)" : T ? "Personal Finance (8.5% base, DBR 45%)" : E ? "SME Working Capital (7.0% base, DBR 50%)" : "Standard Home Loan";
		return {
			message: C ? `Excellent choice. A <strong>Green Home Loan linked to GSAS certification</strong> is a strategically important product — it aligns with CBO Circular 2026-12 on green finance and Oman Vision 2040 sustainability targets.<br><br><strong>Stage 1 — Product Model</strong><br><br>The closest base is our existing <em>${e}</em>. We'd inherit the core credit parameters and then layer on ESG-specific attributes (GSAS score bands, green discounts, ESG document requirements).<br><br><strong>Would you like to clone from Standard Home Loan as a starting point, or configure everything from scratch?</strong>` : `Good. I'll help configure this as a CBO-compliant <strong>${O}</strong> for the Omani market.<br><br><strong>Stage 1 — Product Model</strong><br><br>Closest existing product: <em>${e}</em>.<br><br><strong>Shall we clone from this as a base?</strong>`,
			current_stage: 1,
			show_roadmap: !0,
			action: "none",
			ui_events: [],
			product_draft: null,
			rules_draft: null,
			schema_draft: null
		};
	}
	if (s && !c) return i || r.includes("clone") || r.includes("standard"), {
		message: `Noted — ${r.includes("scratch") ? "configuring from scratch" : "cloning from <em>Standard Home Loan</em>"}.<br><br><strong>Financing structure:</strong> Should this product be:<br><br>&bull; <strong>Conventional</strong> — standard interest-bearing mortgage (most of our existing portfolio)<br>&bull; <strong>Islamic – Diminishing Musharaka</strong> — co-ownership with declining bank share; more complex to configure but growing demand (especially for Omani nationals)<br>&bull; <strong>Islamic – Murabaha</strong> — cost-plus financing, simpler structure<br><br>Most of our green home loan applicants are conventional at this stage. <strong>Which structure should this product use?</strong>`,
		current_stage: 1,
		show_roadmap: !1,
		action: "none",
		ui_events: [],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (s && c && !l) return {
		message: `${r.includes("islamic") || r.includes("musharaka") || r.includes("murabaha") ? "Islamic" : "Conventional"} structure — confirmed.<br><br><strong>Target customer segment:</strong><br><br>&bull; <strong>Omani Nationals only</strong> — higher LTV permitted (up to 90%), eligible for government salary-backed schemes<br>&bull; <strong>Expats included</strong> — residency ≥1 year remaining required; max LTV typically 80% for expats; GSAS requirement still applies<br>&bull; <strong>Both, with tiered terms</strong> — different LTV and income thresholds per nationality<br><br>Income band target:<br>&bull; <strong>Mass market</strong> (OMR 800–2,000/mo net) — larger volume, stricter DBR management<br>&bull; <strong>Affluent</strong> (OMR 2,000–5,000/mo) — preferred for green premium tier<br>&bull; <strong>Both</strong><br><br><strong>Who is the primary target — nationals only or both, and what income segment?</strong>`,
		current_stage: 1,
		show_roadmap: !1,
		action: "none",
		ui_events: [],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (s && c && l && !u) {
		r.includes("both") || r.includes("all");
		let e = r.includes("national") && !r.includes("both"), t = r.includes("affluent") || r.includes("2,000") || r.includes("2000"), n = C ? t ? "Sohar Green Home Finance – GSAS Premium" : "Sohar Green Home Finance – GSAS" : `${O}`;
		return {
			message: `Segment noted — ${e ? "Omani nationals" : "nationals and expats"}, ${t ? "affluent tier (OMR 2K+)" : "mass and affluent"}.<br><br>For the product name, I suggest: <strong>"${n}"</strong><br><br>This follows our naming convention: Bank · Product Type · Variant. The GSAS suffix signals the ESG positioning immediately to customers and regulators.<br><br><strong>Shall I use "${n}", or do you have a different name in mind?</strong>`,
			current_stage: 1,
			show_roadmap: !1,
			action: "none",
			ui_events: [],
			product_draft: null,
			rules_draft: null,
			schema_draft: null
		};
	}
	if (u && !d) {
		let t = i ? "Sohar Green Home Finance – GSAS" : e.length > 3 && e.length < 80 ? e.trim() : "Sohar Green Home Finance – GSAS";
		return {
			message: `✅ <strong>Stage 1 complete.</strong> Product model defined — "${t}", conventional, cloned from Standard Home Loan.<br><br><strong>Stage 2 — Core Configuration</strong><br><br><strong>Pricing structure recommendation:</strong><br><br>Base rate: <strong>5.25%</strong> per annum (10 bps below Standard Home Loan at 5.35%) — a modest incentive for green adoption without significant NIM compression.<br><br>CBO Circular 2026-12 §3.1 permits preferential pricing for green-certified products. Our current cost of funds is ~3.8%, giving a spread of ~1.45% — acceptable for this asset class.<br><br><strong>Shall I set the base rate at 5.25%, or would you like to adjust it?</strong>`,
			current_stage: 2,
			show_roadmap: !1,
			action: "none",
			ui_events: [
				{
					type: "set_tab",
					tab: "general"
				},
				{
					type: "set_field",
					field: "name",
					value: t
				},
				{
					type: "set_field",
					field: "description",
					value: "Preferential home financing for GSAS-certified green properties. Earn up to 0.75% rate discount based on sustainability score. Supports Oman Vision 2040 and CBO green finance objectives."
				},
				{
					type: "highlight_field",
					field: "name"
				}
			],
			product_draft: null,
			rules_draft: null,
			schema_draft: null
		};
	}
	if (d && !f && C) return {
		message: "Base rate set at 5.25%. Confirmed.<br><br><strong>ESG Green Discount tiers</strong> — this is what differentiates a real green product from a standard one:<br><br>&bull; <strong>GSAS Score ≥ 85 (Gold/Platinum)</strong> → −0.75% discount → effective rate <strong>4.50%</strong><br>&bull; <strong>GSAS Score 70–84 (Silver)</strong> → −0.50% discount → effective rate <strong>4.75%</strong><br>&bull; <strong>GSAS Score &lt; 70</strong> → <span style=\"color:#f87171\">NOT eligible</span> (product requires minimum Silver certification)<br><br>These tiers incentivise customers to choose higher-rated green properties. Oman's GORD (Gulf Organisation for Research & Development) manages GSAS ratings under OS GSO 3000:2025.<br><br><strong>Should I apply these discount tiers, or do you want different GSAS score thresholds or discount spreads?</strong>",
		current_stage: 2,
		show_roadmap: !1,
		action: "none",
		ui_events: [
			{
				type: "set_tab",
				tab: "pricing"
			},
			{
				type: "set_field",
				field: "base_rate",
				value: 5.25
			},
			{
				type: "highlight_field",
				field: "base_rate"
			}
		],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if ((f || d && !C) && !p) return {
		message: "Green discount tiers confirmed — 0.75% for Gold/Platinum (≥85), 0.5% for Silver (70–84).<br><br><strong>Loan-to-Value (LTV) bands:</strong><br><br>Under CBO Circular BM/REG/2019/74, residential mortgages are capped at:<br>&bull; <strong>First home purchase</strong>: up to <strong>90% LTV</strong><br>&bull; <strong>Second/subsequent property</strong>: up to <strong>80% LTV</strong><br>&bull; <strong>Expat customers</strong>: max <strong>80% LTV</strong> regardless of purchase number<br><br>For a green home loan, I recommend keeping the CBO maximum (90% for first home, 80% otherwise) — the GSAS certification already provides quality collateral assurance through certified construction standards.<br><br><strong>Shall I configure LTV at 90% (first home) / 80% (subsequent/expat), or do you want stricter limits?</strong>",
		current_stage: 2,
		show_roadmap: !1,
		action: "none",
		ui_events: [
			{
				type: "set_field",
				field: "gsas_min_score",
				value: 70
			},
			{
				type: "set_field",
				field: "gsas_premium_score",
				value: 85
			},
			{
				type: "set_field",
				field: "green_discount_premium",
				value: .75
			},
			{
				type: "set_field",
				field: "green_discount_standard",
				value: .5
			},
			{
				type: "highlight_field",
				field: "green_discount_premium"
			}
		],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (p && !m) return {
		message: "LTV set: 90% first home, 80% subsequent/expat. Confirmed.<br><br><strong>Debt Burden Ratio (DBR) limit:</strong><br><br>Standard CBO maximum is 50% of net monthly income. However, <strong>CBO Circular 2026-12 §3.2 explicitly allows an enhanced DBR of up to 55% for green-certified financing products</strong> — a 5% relaxation designed to incentivise green uptake.<br><br>My recommendation:<br>&bull; <strong>55% DBR</strong> for green-certified loans (using the CBO allowance)<br>&bull; <strong>50% DBR</strong> standard safety floor for all other cases<br><br>This gives customers slightly more headroom when purchasing green properties, directly supporting adoption.<br><br><strong>Shall I set DBR at 55% for this green product, or do you prefer the standard 50%?</strong>",
		current_stage: 2,
		show_roadmap: !1,
		action: "none",
		ui_events: [{
			type: "set_field",
			field: "max_ltv",
			value: 90
		}, {
			type: "highlight_field",
			field: "max_ltv"
		}],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (m && !h) return {
		message: "DBR at 55% confirmed — using CBO green finance allowance (Circular 2026-12 §3.2).<br><br><strong>Term and amount ranges:</strong><br><br>&bull; <strong>Term</strong>: min 3 years, max <strong>25 years</strong> (CBO ceiling for residential mortgages). For green, no reason to shorten — longer terms support larger green property purchases.<br>&bull; <strong>Minimum loan</strong>: <strong>OMR 25,000</strong> — below this, the GSAS certification cost (~OMR 3,000–8,000) makes the product uneconomical for the customer<br>&bull; <strong>Maximum loan</strong>: <strong>OMR 500,000</strong> — our standard residential cap; above this goes to Commercial Real Estate<br><br><strong>Are these ranges acceptable — 3–25 years, OMR 25K–500K — or do you want to adjust?</strong>",
		current_stage: 2,
		show_roadmap: !1,
		action: "none",
		ui_events: [{
			type: "set_field",
			field: "max_dbr",
			value: 55
		}, {
			type: "highlight_field",
			field: "max_dbr"
		}],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (h && !g) return {
		message: "Term and amounts set: 3–25 years, OMR 25,000–500,000. Confirmed.<br><br><strong>Fee structure:</strong><br><br>Under CBO Consumer Protection Circular 2018/2, all fees must be disclosed upfront. Recommended:<br><br>&bull; <strong>Arrangement fee</strong>: 1% of loan amount, capped at OMR 500 — standard market rate, waived for GSAS Platinum (≥90 score) as an additional green incentive<br>&bull; <strong>Early settlement penalty</strong>: 1% of outstanding balance (CBO maximum allowed) — or waived after year 5 to encourage refinancing into newer green products<br>&bull; <strong>Valuation fee</strong>: actual cost (OMR 200–800 depending on property) — pass-through to customer<br>&bull; <strong>GSAS re-validation fee</strong>: OMR 150 (charged at certificate renewal, every 3 years) — new ESG-specific fee<br><br><strong>Should I apply this fee structure, or modify any of these?</strong>",
		current_stage: 2,
		show_roadmap: !1,
		action: "none",
		ui_events: [
			{
				type: "set_field",
				field: "min_amount",
				value: 25e3
			},
			{
				type: "set_field",
				field: "max_amount",
				value: 5e5
			},
			{
				type: "set_field",
				field: "max_term",
				value: 25
			},
			{
				type: "highlight_field",
				field: "max_amount"
			}
		],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (g && !_) return {
		message: "✅ <strong>Stage 2 complete.</strong> Full pricing and configuration set:<br>Rate 5.25% · Green discount 0.75%/0.5% · LTV 90/80% · DBR 55% · OMR 25K–500K · Term 25yr max<br><br><strong>Stage 3 — Eligibility Rules</strong><br><br>I'll now generate <strong>17 eligibility rules</strong> covering 5 categories: credit risk, collateral, ESG/green, income & employment, and documentation. All rules are cited against specific CBO circulars and OS GSO standards.<br><br>One key decision before I generate: <strong>GSAS minimum score</strong>:<br>&bull; <strong>70 (Silver minimum)</strong> — broader market eligibility, higher volume, lower average green quality<br>&bull; <strong>75 (stricter Silver)</strong> — better ESG positioning, may reduce addressable market by ~20%<br><br><strong>Which GSAS minimum should I use: 70 or 75?</strong>",
		current_stage: 3,
		show_roadmap: !1,
		action: "none",
		ui_events: [],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (_ && !v) {
		let e = r.includes("75") ? 75 : r.includes("70") ? 70 : D >= 70 ? D : 70, t = [
			{
				name: "DBR ≤ 55% (Loans > OMR 100K)",
				category: "creditworthiness",
				metric: "DBR",
				operator: "<=",
				threshold_value: 55,
				threshold_condition: "loan_amount > 100000",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Circular 2026-12, §3.2",
				ai_confidence: 96,
				description: "Maximum debt burden ratio 55% for green finance loans exceeding OMR 100,000. CBO green finance allowance."
			},
			{
				name: "DBR ≤ 60% (Loans ≤ OMR 100K)",
				category: "creditworthiness",
				metric: "DBR",
				operator: "<=",
				threshold_value: 60,
				threshold_condition: "loan_amount <= 100000",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Circular BM/REG/2019/74, §4",
				ai_confidence: 95,
				description: "Standard DBR cap for smaller loan amounts. CBO residential mortgage DBR ceiling."
			},
			{
				name: "Credit Score ≥ 620 (Oman CRB)",
				category: "creditworthiness",
				metric: "credit_score",
				operator: ">=",
				threshold_value: 620,
				threshold_condition: null,
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Credit Bureau Framework, §6.1",
				ai_confidence: 94,
				description: "Minimum credit score from Oman Credit Bureau (OCB). Score below 620 indicates elevated default risk. Auto-rejected."
			},
			{
				name: "No Active Defaults (24 Months)",
				category: "creditworthiness",
				metric: "default_history_months",
				operator: ">=",
				threshold_value: 24,
				threshold_condition: "default_count = 0",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Circular on Loan Classification, §3",
				ai_confidence: 97,
				description: "No payment defaults, restructured loans, or write-offs in the past 24 months. Hard reject — no exceptions."
			},
			{
				name: "Max 4 Active Credit Facilities",
				category: "creditworthiness",
				metric: "active_facilities_count",
				operator: "<=",
				threshold_value: 4,
				threshold_condition: null,
				action_on_breach: "flag",
				severity: "soft",
				regulatory_reference: "CBO Circular BM/REG/2019/74, §5.2",
				ai_confidence: 88,
				description: "Applicants with >4 active facilities flagged for enhanced underwriting review. Soft rule — underwriter discretion."
			},
			{
				name: "LTV ≤ 90% (First Home)",
				category: "collateral",
				metric: "LTV",
				operator: "<=",
				threshold_value: 90,
				threshold_condition: "is_first_home = true",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Circular BM/REG/2019/74, §7.1",
				ai_confidence: 98,
				description: "Maximum LTV 90% for first-home purchase by Omani nationals. CBO absolute ceiling."
			},
			{
				name: "LTV ≤ 80% (Subsequent/Expat)",
				category: "collateral",
				metric: "LTV",
				operator: "<=",
				threshold_value: 80,
				threshold_condition: "is_first_home = false OR nationality = expat",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Circular BM/REG/2019/74, §7.2",
				ai_confidence: 97,
				description: "Maximum LTV 80% for non-first home purchases and all expat applicants."
			},
			{
				name: "CBO-Approved Property Valuator",
				category: "collateral",
				metric: "valuator_approved",
				operator: "=",
				threshold_value: 1,
				threshold_condition: null,
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Valuations Circular 2021/8",
				ai_confidence: 93,
				description: "Property must be valued by a CBO-approved independent valuator (Al Mashora, JLL, Cushman). No self-valuation."
			},
			{
				name: "Title: Freehold or 99-Year Leasehold",
				category: "collateral",
				metric: "title_type",
				operator: "in",
				threshold_value: 1,
				threshold_condition: "freehold OR leasehold_years >= 99",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "Royal Decree 12/2006 (Property Law)",
				ai_confidence: 91,
				description: "Only freehold title deeds or 99-year leaseholds accepted as collateral. Shorter-term leaseholds rejected."
			},
			{
				name: `GSAS Score ≥ ${e} (Minimum Eligibility)`,
				category: "esg",
				metric: "gsas_score",
				operator: ">=",
				threshold_value: e,
				threshold_condition: null,
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "OS GSO 3000:2025, §4.2 · CBO Circular 2026-12, §2.1",
				ai_confidence: 98,
				description: `Minimum GSAS sustainability score of ${e} (${e >= 75 ? "strong Silver" : "Silver"} rating). Property must hold valid GSAS certificate from GORD. Hard reject — no waiver.`
			},
			{
				name: "EPC Rating ≥ C (Energy Performance)",
				category: "esg",
				metric: "epc_rating",
				operator: ">=",
				threshold_value: 3,
				threshold_condition: "A=5, B=4, C=3, D=2, E=1",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "OEESC (Oman Energy Efficiency & Sustainability Code), §5.1",
				ai_confidence: 94,
				description: "Minimum Energy Performance Certificate rating of C. Assessed by OEESC-accredited assessor. EPC must be valid (not expired)."
			},
			{
				name: "GSAS Certificate Valid ≥ 90 Days",
				category: "esg",
				metric: "gsas_cert_days_remaining",
				operator: ">=",
				threshold_value: 90,
				threshold_condition: null,
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "OS GSO 3000:2025, §6.3 · CBO Circular 2026-12, §2.3",
				ai_confidence: 96,
				description: "GSAS certificate must be issued by GORD, not expired, and have ≥90 days validity remaining at loan disbursement."
			},
			{
				name: "EIA Clearance (Projects > 20 Units)",
				category: "esg",
				metric: "eia_approval",
				operator: "=",
				threshold_value: 1,
				threshold_condition: "project_units > 20",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "Environment Authority Decision 107/2023",
				ai_confidence: 91,
				description: "Environmental Impact Assessment approval from Oman Environment Authority required for developments with more than 20 residential units."
			},
			{
				name: "ESG Document Set: All 3 Required",
				category: "esg",
				metric: "esg_docs_complete",
				operator: "=",
				threshold_value: 1,
				threshold_condition: "gsas_cert AND epc_report AND (eia_approval OR project_units <= 20)",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Circular 2026-12, §5.1",
				ai_confidence: 97,
				description: "Complete ESG document set required: (1) GSAS Certificate, (2) EPC Report, (3) EIA Approval (if applicable). Missing any document = auto-reject."
			},
			{
				name: "Minimum Net Income OMR 800/Month",
				category: "eligibility",
				metric: "net_monthly_income",
				operator: ">=",
				threshold_value: 800,
				threshold_condition: null,
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "Sohar Internal Credit Policy §12.1",
				ai_confidence: 92,
				description: "Minimum verified net monthly income of OMR 800. Verified against salary certificate and payroll data. Self-employed: average of last 24 months audited income."
			},
			{
				name: "Employment Tenure ≥ 6 Months",
				category: "eligibility",
				metric: "employment_months",
				operator: ">=",
				threshold_value: 6,
				threshold_condition: "employment_type = salaried",
				action_on_breach: "flag",
				severity: "soft",
				regulatory_reference: "Sohar Internal Credit Policy §12.2",
				ai_confidence: 87,
				description: "Salaried applicants must have ≥6 months at current employer. Soft rule — underwriter may override with salary continuity evidence."
			},
			{
				name: "Expat Residency ≥ 12 Months Remaining",
				category: "eligibility",
				metric: "residency_days_remaining",
				operator: ">=",
				threshold_value: 365,
				threshold_condition: "nationality = expat",
				action_on_breach: "reject",
				severity: "hard",
				regulatory_reference: "CBO Circular on Expat Credit Facilities, §3",
				ai_confidence: 95,
				description: "Expat applicants must have at least 12 months remaining on current residency permit at time of application. Hard reject."
			}
		];
		return {
			message: `✅ <strong>Stage 3 complete.</strong> <strong>${t.length} eligibility rules</strong> generated and added to the Eligibility tab — check it now!<br><br><strong>Credit rules (5):</strong> DBR ≤55% (>100K), DBR ≤60% (≤100K), Credit Score ≥620, No defaults 24mo, Max 4 facilities<br><strong>Collateral rules (4):</strong> LTV ≤90% first home, ≤80% subsequent/expat, Approved valuator, Freehold/leasehold title<br><strong>ESG rules (5):</strong> GSAS ≥${e}, EPC ≥C, GSAS cert valid ≥90 days, EIA clearance, Full document set<br><strong>Income/employment (3):</strong> Net income ≥OMR 800, Tenure ≥6mo, Expat residency ≥12mo<br><br><strong>Stage 4 — Approval Workflow</strong><br><br>I'll configure a <strong>10-step workflow</strong> with 4 external API integrations: eKYC/NCI, Oman Credit Bureau, GSAS registry (GORD), property valuation APIs, and Muscat Municipality title check.<br><br>First 5 steps are fully automated (0 human time, ~15 hours total). Last 5 require human review (credit analyst, green finance officer, risk officer, PM).<br><br><strong>Should I configure automated processing for the first 5 steps, or do you want more human touchpoints in the automated phase?</strong>`,
			current_stage: 4,
			show_roadmap: !1,
			action: "none",
			ui_events: [{
				type: "set_tab",
				tab: "eligibility"
			}, ...t.map((e) => ({
				type: "add_rule",
				rule: e
			}))],
			product_draft: null,
			rules_draft: t,
			schema_draft: null
		};
	}
	if (v && !y) return {
		message: "✅ <strong>Stage 4 complete.</strong> 10-step approval workflow configured and visible in the Workflow tab.<br><br><strong>Automated steps (1–6):</strong> eKYC/AML → Credit Bureau → OCR/Validation → GSAS Registry (GORD) → Property Valuation → Title Check<br><strong>Human review steps (7–10):</strong> Credit Underwriting (24h) → Green Finance ESG Review (24h) → Risk & Compliance (48h) → PM Final Approval (24h)<br><br>⏱️ Total SLA: <strong>~5 working days</strong> (automated: <19h, human: ~4 days)<br>🔗 External integrations: NCI eKYC · Oman Credit Bureau · GORD GSAS API · Al Mashora/JLL · Muscat Municipality<br><br><strong>Ready for Stage 5 — Compliance Classification?</strong> I'll apply Basel III capital rules, IFRS 9 provisioning, and CBO green finance tagging. Shall I proceed?",
		current_stage: 5,
		show_roadmap: !1,
		action: "none",
		ui_events: [{
			type: "set_tab",
			tab: "workflow"
		}, {
			type: "set_workflow",
			nodes: [
				{
					id: "n1",
					type: "start",
					label: "Application Submitted",
					role: null,
					description: "Customer submits via Sohar Mobile App, Internet Banking, or branch. Application ID generated. Documents uploaded to secure vault."
				},
				{
					id: "n2",
					type: "task",
					label: "eKYC & AML Screening",
					role: "system",
					sla_hours: 1,
					auto: !0,
					description: "Calls National Centre for Information (NCI) eKYC API — biometric Civil ID verification. Simultaneous AML/CFT screening via WorldCheck/Refinitiv. Result: identity_verified. Auto-reject if AML hit."
				},
				{
					id: "n3",
					type: "task",
					label: "Oman Credit Bureau Check",
					role: "system",
					sla_hours: 4,
					auto: !0,
					description: "Calls OCB API. Retrieves: credit score, active facilities count, payment history 24 months, defaults, restructured loans. Auto-reject: score <620 or any default in 24mo."
				},
				{
					id: "n4",
					type: "task",
					label: "Document OCR & AI Validation",
					role: "system",
					sla_hours: 2,
					auto: !0,
					description: "AI OCR extracts structured data from: salary certificate, Civil ID, GSAS certificate, EPC report, EIA approval. Validates field formats vs. product schema. Confidence score per document."
				},
				{
					id: "n5",
					type: "task",
					label: "GSAS Registry Verification (GORD API)",
					role: "system",
					sla_hours: 4,
					auto: !0,
					description: "Calls GORD GSAS API. Validates: certificate number authenticity, issuer = GORD, score matches submitted cert, rating band (Silver/Gold/Platinum), expiry ≥ 90 days, property address matches application."
				},
				{
					id: "n6",
					type: "task",
					label: "Property Valuation & Title Verification",
					role: "system",
					sla_hours: 8,
					auto: !0,
					description: "API integration: Al Mashora/JLL Oman for desktop or drive-by valuation. Muscat Municipality / MRMEWR API for title deed authenticity, ownership zone (ITC/Omani zone), freehold confirmation. Calculates LTV against confirmed valuation."
				},
				{
					id: "n7",
					type: "approval",
					label: "Credit Underwriting",
					role: "credit_analyst",
					sla_hours: 24,
					description: "Credit Analyst reviews: income vs salary cert, DBR calculation with all facilities, stress test at base rate +2% (must still pass DBR), LTV confirmation, employment stability. Uses Sohar internal credit scoring model (FICO-based adaptation)."
				},
				{
					id: "n8",
					type: "approval",
					label: "Green Finance ESG Review",
					role: "green_finance_officer",
					sla_hours: 24,
					description: "Dedicated Green Finance Officer (new role under CBO Circular 2026-12): validates GSAS score vs product threshold, EPC rating band, EIA coverage scope, determines applicable discount tier (0.75% if GSAS ≥85, 0.5% if 70–84), confirms approved materials list for staged disbursement."
				},
				{
					id: "n9",
					type: "approval",
					label: "Risk & Compliance Sign-off",
					role: "risk_officer",
					sla_hours: 48,
					description: "Risk Officer: concentration risk check (green portfolio exposure limit), IFRS9 Stage 1 classification, regulatory capital calculation (risk weight 75% residential mortgage), secondary AML/CFT review, CBO reporting flags."
				},
				{
					id: "n10",
					type: "approval",
					label: "PM Final Approval & Offer Letter",
					role: "product_manager",
					sla_hours: 24,
					description: "Product Manager: confirms all product terms match approved configuration, green discount applied correctly per GSAS score, offer letter generated from template, CBO disclosure checklist completed, signed digitally via DocuSign."
				},
				{
					id: "n11",
					type: "end",
					label: "Decision & Letter of Offer Issued",
					role: null,
					description: "Approved: Letter of Offer sent via SMS + email + in-app. SLA: customer 7 working days. Rejected: reason code + remediation guidance. Customer has 30 days to accept offer."
				}
			]
		}],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (y && !b) return {
		message: "<strong>Stage 5 — Compliance Classification</strong><br><br>For regulatory reporting, I recommend classifying this product as follows:<br>&bull; <strong>Basel III risk weight</strong>: 75% (residential retail mortgage, LTV ≤90% per CBO BM/REG/2019/74 Schedule 3)<br>&bull; <strong>IFRS 9 provisioning</strong>: 1.5% Stage 1 ECL (higher than standard 1.0% due to green portfolio concentration, per IFRS 9 §5.5)<br>&bull; <strong>CBO classification</strong>: Green Finance (reportable under Circular 2026-12 §7 monthly ESG portfolio return)<br>&bull; <strong>AML risk tier</strong>: LOW (eKYC + OCB auto-verified; green property reduces beneficial ownership complexity)<br>&bull; <strong>Regulatory tags</strong>: #CLIMATE_RISK · #ESG_ELIGIBILITY · #GREEN_FINANCING · #OMAN_VISION_2040<br><br><strong>Shall I apply these compliance parameters, or do you want to adjust the risk weight or provisioning rate?</strong>",
		current_stage: 5,
		show_roadmap: !1,
		action: "none",
		ui_events: [{
			type: "set_tab",
			tab: "compliance"
		}],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
	if (b && !x) {
		let e = a.filter((e) => e.role === "user").map((e) => (e.content || "").toLowerCase()), t = [...o, ...e].join(" "), n = "Sohar Green Home Finance – GSAS", r = o.find((e) => /stage\s+1\s+complete/i.test(e));
		if (r) {
			let e = r.match(/stage\s+1\s+complete[\u2014\u2013\-\.\s]+([A-Z][^,\n]{3,59}),/i) || r.match(/"([^"]{4,60})"/);
			if (e) {
				let t = e[1].trim().replace(/[.!]$/, "");
				/[A-Z]/.test(t) && t.split(" ").length <= 8 && (n = t);
			}
		}
		if (n === "Sohar Green Home Finance – GSAS") {
			let e = o.find((e) => /how about/i.test(e) && (/[""""]/.test(e) || e.includes("\"")));
			if (e) {
				let t = e.match(/[""""']([A-Z][^""""\n]{3,59})[""""']/) || e.match(/"([^"]{4,60})"/);
				if (t) {
					let e = t[1].trim().replace(/[.!]$/, "");
					/[A-Z]/.test(e) && e.split(" ").length <= 8 && (n = e);
				}
			}
		}
		if (n === "Sohar Green Home Finance – GSAS") {
			let e = o.find((e) => (e.includes("confirmed") || e.includes("name works") || e.includes("name is set")) && /[""""]/.test(e));
			if (e) {
				let t = e.match(/[""""']([A-Z][^""""\n]{3,59})[""""']/);
				if (t) {
					let e = t[1].trim().replace(/[.!]$/, "");
					/[A-Z]/.test(e) && e.split(" ").length <= 8 && (n = e);
				}
			}
		}
		let i = (() => {
			let e = a.filter((e) => e.role === "user").map((e) => (e.content || "").toLowerCase());
			for (let t = e.length - 1; t >= 0; t--) {
				let n = e[t], r = n.match(/(?:lower|change|set|reduce|make).*?(\d[\d,]+)\s*omr/) || n.match(/omr\s*(\d[\d,]+)\s*(?:max|maximum|limit)/) || n.match(/(?:maximum|max)\s*(?:loan|amount)?\s*(?:to|is|of)?\s*(?:omr)?\s*(\d[\d,]+)/i);
				if (r) {
					let e = parseInt(r[1].replace(/,/g, ""));
					if (e >= 5e4 && e <= 5e6) return e;
				}
			}
			for (let e = o.length - 1; e >= 0; e--) {
				let t = o[e], n = t.match(/(?:omr\s*[\d,]+\s*[\u2013\u2014\-]{1,2}\s*omr\s*)([\d,]+)/i) || t.match(/(?:amount(?:\s+range)?[:\s]+omr\s*[\d,]+\s*[\u2013\-]\s*)([\d,]+)/i) || t.match(/(?:up to|maximum|max)\s*omr\s*([\d,]+)/i);
				if (n) {
					let e = parseInt(n[1].replace(/,/g, ""));
					if (e >= 5e4 && e <= 5e6) return e;
				}
			}
			return t.includes("500,000") || t.match(/\b500k\b/) ? 5e5 : t.includes("1,000,000") || t.match(/\b1m\b/) ? 1e6 : 5e5;
		})(), s = (() => {
			for (let e = o.length - 1; e >= 0; e--) {
				let t = o[e], n = t.match(/omr\s*([\d,]+)\s*(?:to|-)\s*omr\s*[\d,]+/i) || t.match(/(?:minimum|min)\s+(?:loan\s+)?(?:amount\s+)?(?:of\s+)?omr\s*([\d,]+)/i);
				if (n) {
					let e = parseInt(n[1].replace(/,/g, ""));
					if (e >= 5e3 && e <= 2e5) return e;
				}
			}
			return 25e3;
		})(), c = (() => {
			let e = o.find((e) => e.includes("gsas ≥") || e.includes("gsas minimum") || e.includes("gsas score ≥"));
			if (e) {
				let t = e.match(/gsas[^0-9]*([0-9]{2})/i);
				if (t) {
					let e = parseInt(t[1]);
					if (e >= 65 && e <= 90) return e;
				}
			}
			return t.includes("75") ? 75 : 70;
		})(), l = (() => {
			let e = t.match(/base rate[^0-9]*([0-9]+\.[0-9]+)%/);
			return e ? parseFloat(e[1]) : (t.includes("5.25"), 5.25);
		})(), u = (() => {
			for (let e = o.length - 1; e >= 0; e--) {
				let t = o[e], n = t.match(/(\d+\.\d+)%[^.]*(?:gsas[^.]*[≥>=]\s*85|gold|premium)/i) || t.match(/(?:gold|premium|gsas[^.]*[≥>=]\s*85)[^.]*?(\d+\.\d+)%/i);
				if (n) {
					let e = parseFloat(n[1]);
					if (e >= .1 && e <= 2) return e;
				}
			}
			return .75;
		})(), d = (() => {
			for (let e = o.length - 1; e >= 0; e--) {
				let t = o[e], n = t.match(/(\d+\.\d+)%[^.]*(?:silver|70[^0-9]|score\s+70)/i) || t.match(/(?:silver|70[–\-]84)[^.]*?(\d+\.\d+)%/i);
				if (n) {
					let e = parseFloat(n[1]);
					if (e >= .1 && e <= 2) return e;
				}
			}
			return .5;
		})(), f = (() => {
			for (let e = o.length - 1; e >= 0; e--) {
				let t = o[e], n = t.match(/(?:term\s+range[^0-9]*|from\s+)(\d{1,2})\s*(?:to|–|-)\s*\d{1,2}\s*years?/i) || t.match(/(?:minimum\s+(?:term|of)\s*)(\d{1,2})\s*years?/i);
				if (n) {
					let e = parseInt(n[1]);
					if (e >= 1 && e <= 15) return e;
				}
			}
			return 3;
		})(), p = t.includes("hnw") || t.includes("high net worth") || t.match(/omr\s*5[k,\s]|5,000\+|income.*5000/i) != null, m = !p && (t.includes("affluent") || t.match(/omr\s*2[k,\s]|2,000/i) != null), h = e.join(" "), g = h.includes("islamic") || h.includes("murabaha") || h.includes("musharaka") ? "Islamic (Diminishing Musharaka)" : "Conventional", _ = {
			name: n,
			description: `${g} home financing for GSAS-certified green properties in Oman. Earn up to ${u}% rate discount based on sustainability score (GSAS ≥85: Gold tier, ${d}% for GSAS 70–84: Silver). Targets ${p ? "HNW" : m ? "affluent" : "retail"} customers. Supports Oman Vision 2040, CBO green finance objectives, and OS GSO 3000:2025.`,
			category: "home_loan",
			base_rate: l,
			max_ltv: 90,
			max_dbr: 55,
			green_dbr: 55,
			min_term: f,
			max_term: 25,
			min_amount: s,
			max_amount: i,
			gsas_min_score: c,
			gsas_premium_score: 85,
			green_discount_premium: u,
			green_discount_standard: d,
			esg_required_docs: [
				"gsas_cert",
				"epc_report",
				"eia_approval"
			],
			approved_materials: [
				"Green Concrete (GSAS-rated)",
				"Low-E Double Glazing",
				"Thermal Insulation (R-value ≥ 2.5)",
				"Solar PV Panels (SASO-certified)",
				"LED Lighting Systems",
				"High-Efficiency HVAC (EER ≥ 3.5)",
				"Recycled Steel Reinforcement",
				"Rainwater Harvesting System"
			],
			approved_vendors: [
				"Oman Readymix LLC",
				"Gulf Insulation Group",
				"SunTech Oman",
				"Green Build Oman",
				"EcoMaterials Oman",
				"HVAC Oman LLC",
				"Voltec Solar Oman"
			],
			clone_from_id: "p001"
		};
		`${c}`, `${c}`;
		let v = {
			schema_type: "gsas_certificate_validation",
			fields: [
				{
					name: "Certificate Number",
					type: "String",
					validation: "^GSAS-\\d{4}-\\d{3,5}$",
					error_message: "Invalid GSAS certificate number format (expected: GSAS-YYYY-NNN)"
				},
				{
					name: "Issuer",
					type: "String",
					validation: "Must be \"GORD\" or GORD-accredited body",
					error_message: "Issuer not GORD-accredited"
				},
				{
					name: "Issue Date",
					type: "Date",
					validation: "Must be ≤ today",
					error_message: "Certificate issue date is in the future"
				},
				{
					name: "Expiry Date",
					type: "Date",
					validation: "Must be ≥ today + 90 days",
					error_message: "Certificate expires within 90 days — not acceptable"
				},
				{
					name: "Overall Score",
					type: "Integer",
					validation: `0–100, minimum ${c} for eligibility`,
					error_message: `Score below minimum threshold (${c})`
				},
				{
					name: "Rating",
					type: "String",
					validation: "Silver / Gold / Platinum only (Bronze rejected)",
					error_message: "Bronze rating does not meet minimum requirement"
				},
				{
					name: "Property Address",
					type: "String",
					validation: "Must match application property address (fuzzy match ≥85%)",
					error_message: "Certificate property address does not match application"
				},
				{
					name: "EPC Rating",
					type: "String",
					validation: "A / B / C minimum (D/E/F/G rejected)",
					error_message: "EPC rating below minimum required (C)"
				}
			],
			ai_confidence: 96,
			regulatory_reference: "OS GSO 3000:2025, §4.2 · OEESC §5.1"
		}, y = p ? 28e4 : m ? 15e4 : 9e4, b = p ? 38e4 : m ? 2e5 : 12e4, x = p ? 8 : m ? 12 : 18, S = Math.round(x / 100 * 795), C = Math.round(S * y / 1e6 * 10) / 10;
		l - u;
		let w = Math.round((l - 3.5) * 100) / 100, T = p ? 9 : m ? 11 : 14, E = (l - u).toFixed(2), D = (l - d).toFixed(2), O = p ? "HNW (OMR 5K+ income)" : m ? "Affluent (OMR 2K–5K)" : "Mass market";
		return {
			message: `✅ <strong>Stage 5 complete.</strong> Compliance classification applied — Basel III 75% risk weight, IFRS9 1.5% Stage 1 ECL, CBO Green Finance designation.<br><br><strong>Stage 6 — Portfolio Simulation</strong><br><br>📊 <strong>12-month portfolio projections</strong> — <em>${O} segment · avg loan OMR ${y.toLocaleString()}</em><br>&bull; <strong>Pipeline:</strong> ~795 green-eligible applicants from current 13,251 YTD pipeline (est. 6% hold GSAS-certified properties)<br>&bull; <strong>Target:</strong> <strong>${S} accounts · OMR ${C}M</strong> in Year 1 at ${x}% pipeline conversion (${p ? "conservative — HNW segment has longer decision cycle" : "moderate — verified against regional green mortgage benchmarks"})<br>&bull; <strong>NIM:</strong> ~${w.toFixed(2)}% on green book (3.5% estimated cost of funds) — partially offset by 0.4% lower provisioning (green ECL) + CBO capital relief ~8 bps<br>&bull; <strong>Effective rates:</strong> ${l}% base → ${E}% (GSAS ≥85 Gold) · ${D}% (GSAS 70–84 Silver)<br>&bull; <strong>Stress test:</strong> +200 bps rate shock — 98% of modelled HNW portfolio passes DBR ≤55% (avg. DBR ${p ? "38" : "44"}% at origination provides buffer)<br>&bull; <strong>Break-even:</strong> month ${T} post-launch (setup: OMR 85K — GORD API integration + Green Finance Officer role)<br>&bull; <strong>ESG reporting:</strong> monthly CBO Green Finance Return (Circular 2026-12 §7) + annual TCFD disclosure<br><br>📋 <strong>Full product configuration summary:</strong><br>• <strong>${n}</strong> · ${g} · Cloned from Standard Home Loan · Segment: ${O}<br>• Rate: <strong>${l}%</strong> · Discount tiers: −${u}% (GSAS ≥85) → <strong>${E}%</strong> · −${d}% (GSAS 70–84) → <strong>${D}%</strong><br>• LTV: <strong>90%</strong> (first home) · <strong>80%</strong> (subsequent/expat) · DBR: <strong>55%</strong> (CBO green allowance)<br>• Terms: <strong>${f}–25 years</strong> · Amount: <strong>OMR ${s.toLocaleString()}–${i.toLocaleString()}</strong> · Avg property value: OMR ${b.toLocaleString()}<br>• Eligibility: <strong>17 rules</strong> across credit, collateral, ESG, income<br>• Workflow: <strong>10-step</strong> (5 auto + 5 human) · SLA: 5 working days<br>• Compliance: Basel III 75% · IFRS9 1.5% · CBO Green Finance · #CLIMATE_RISK · #ESG_ELIGIBILITY · #OMAN_VISION_2040<br><br>🚀 Everything is configured. Click <strong>Confirm &amp; Publish</strong> to save the full product and make it live on the customer portal.`,
			current_stage: 6,
			show_roadmap: !1,
			action: "ready_to_confirm",
			ui_events: [
				{
					type: "set_tab",
					tab: "ai_config"
				},
				{
					type: "set_field",
					field: "name",
					value: n
				},
				{
					type: "set_field",
					field: "base_rate",
					value: l
				},
				{
					type: "set_field",
					field: "max_ltv",
					value: 90
				},
				{
					type: "set_field",
					field: "max_dbr",
					value: 55
				},
				{
					type: "set_field",
					field: "min_term",
					value: f
				},
				{
					type: "set_field",
					field: "max_term",
					value: 25
				},
				{
					type: "set_field",
					field: "min_amount",
					value: s
				},
				{
					type: "set_field",
					field: "max_amount",
					value: i
				},
				{
					type: "set_field",
					field: "gsas_min_score",
					value: c
				},
				{
					type: "set_field",
					field: "green_discount_premium",
					value: u
				},
				{
					type: "set_field",
					field: "green_discount_standard",
					value: d
				}
			],
			product_draft: _,
			rules_draft: null,
			schema_draft: v
		};
	}
	return {
		message: "All 6 stages are complete. Click <strong>Confirm & Publish</strong> above to save the product, or ask me any follow-up questions about the configuration.",
		current_stage: 6,
		show_roadmap: !1,
		action: "ready_to_confirm",
		ui_events: [],
		product_draft: null,
		rules_draft: null,
		schema_draft: null
	};
}
//#endregion
//#region src/api/compliance.ts
var W = new P();
W.get("/esg/:appId", async (e) => {
	let t = e.req.param("appId"), n = t.startsWith("GHL") || t.startsWith("HL"), r = await e.env.DB.prepare(n ? "SELECT * FROM applications WHERE reference = ?" : "SELECT * FROM applications WHERE id = ?").bind(t).first();
	if (!r) return e.json({ error: "Not found" }, 404);
	let { results: i } = await e.env.DB.prepare("SELECT * FROM documents WHERE entity_type = 'project' AND entity_id = ?").bind(r.project_id).all(), a = i.find((e) => e.doc_type === "gsas_cert"), o = i.find((e) => e.doc_type === "epc_report"), s = i.find((e) => e.doc_type === "eia_approval"), c = a ? JSON.parse(a.extracted_data || "{}") : {}, l = o ? JSON.parse(o.extracted_data || "{}") : {}, u = s ? JSON.parse(s.extracted_data || "{}") : {}, d = {
		gsas: {
			status: a?.validation_status || "pending",
			confidence: a?.ai_confidence || 0,
			score: c.overall_score || r.gsas_score,
			rating: c.rating || "Unknown",
			certificate_number: c.certificate_number || "N/A",
			expiry: c.expiry_date || "N/A",
			color: a?.validation_status === "auto_verified" ? "green" : a?.validation_status === "manual_review" ? "amber" : "red"
		},
		epc: {
			status: o?.validation_status || "pending",
			confidence: o?.ai_confidence || 0,
			rating: l.rating || r.epc_rating || "A",
			expiry: l.expiry_date || "N/A",
			notes: o?.validation_notes || "",
			color: o?.validation_status === "auto_verified" || o?.validation_status === "approved" ? "green" : o?.validation_status === "manual_review" ? "amber" : "red"
		},
		eia: {
			status: s?.validation_status || "pending",
			confidence: s?.ai_confidence || 0,
			reference: u.reference || "N/A",
			issuer: u.issuer || "N/A",
			color: s?.validation_status === "auto_verified" ? "green" : s?.validation_status === "manual_review" ? "amber" : "red"
		},
		ai_recommendation: Ke(a, o, s),
		overall_esg_status: qe(a, o, s)
	}, f = {
		dbr: {
			value: r.dbr,
			max: 55,
			status: r.dbr <= 55 ? "pass" : "fail",
			label: `${r.dbr}% (Max: 55% for green products)`
		},
		ltv: {
			value: r.ltv,
			max: 90,
			status: r.ltv <= 90 ? "pass" : "fail",
			label: `${r.ltv}% (Max: 90%)`
		},
		malaa_score: {
			value: r.malaa_score,
			min: 650,
			status: (r.malaa_score || 750) >= 650 ? "pass" : "fail",
			label: `${r.malaa_score || 750} (Min: 650)`
		},
		stress_test: {
			passed: r.stress_test_passed,
			rate: r.stress_test_rate,
			label: `Passed at ${r.stress_test_rate}% (+350bps)`
		}
	};
	return e.json({
		esg_status: d,
		credit_metrics: f,
		application: r
	});
}), W.post("/:appId/approve-esg", async (e) => {
	let t = e.req.param("appId"), n = await e.req.json(), r = z();
	return await e.env.DB.prepare("\n    UPDATE applications SET esg_verification_status = 'approved', status = 'credit_review', \n    compliance_approved_by = ?, compliance_approved_at = ?, updated_at = ? WHERE id = ?\n  ").bind(n.user_id || "u002", r, r, t).run(), await B(e.env.DB, {
		userId: n.user_id || "u002",
		userName: n.user_name || "Aisha Al-Balushi",
		userRole: "compliance_officer",
		action: "ESG_COMPLIANCE_APPROVED",
		entityType: "application",
		entityId: t,
		details: { notes: n.notes },
		regulatoryReference: n.regulatory_reference
	}), e.json({
		success: !0,
		new_status: "credit_review"
	});
}), W.post("/:appId/approve-risk", async (e) => {
	let t = e.req.param("appId"), n = await e.req.json(), r = z();
	return await e.env.DB.prepare("\n    UPDATE applications SET status = 'approved', risk_approved_by = ?, risk_approved_at = ?, updated_at = ? WHERE id = ?\n  ").bind(n.user_id || "u003", r, r, t).run(), await B(e.env.DB, {
		userId: n.user_id || "u003",
		userName: n.user_name || "Omar Al-Mantheri",
		userRole: "risk_officer",
		action: "CREDIT_RISK_APPROVED",
		entityType: "application",
		entityId: t,
		details: { credit_metrics: n.credit_metrics }
	}), e.json({
		success: !0,
		new_status: "approved"
	});
}), W.post("/:appId/reject", async (e) => {
	let t = e.req.param("appId"), n = await e.req.json();
	return await e.env.DB.prepare("UPDATE applications SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?").bind(n.reason, z(), t).run(), await B(e.env.DB, {
		userId: n.user_id || "u002",
		userName: n.user_name || "Aisha Al-Balushi",
		userRole: "compliance_officer",
		action: "APPLICATION_REJECTED",
		entityType: "application",
		entityId: t,
		details: { reason: n.reason }
	}), e.json({ success: !0 });
});
function Ke(e, t, n) {
	let r = [];
	return (!e || e.validation_status === "pending") && r.push("GSAS certificate pending validation"), t?.validation_status === "manual_review" && r.push("EPC requires manual visual check (88% confidence – image quality)"), (!n || n.validation_status === "pending") && r.push("EIA clearance pending"), r.length === 0 ? {
		action: "Approve",
		detail: "All ESG documents verified. Application meets all green financing criteria.",
		confidence: 96
	} : r.length === 1 && t?.validation_status === "manual_review" ? {
		action: "Approve with Note",
		detail: `Review flagged item: ${r[0]}. EPC Rating A confirmed; expiry 2027 acceptable. Recommend approval.`,
		confidence: 88
	} : {
		action: "Hold for Review",
		detail: `${r.length} items require attention: ${r.join("; ")}`,
		confidence: 70
	};
}
function qe(e, t, n) {
	let r = [
		e?.validation_status,
		t?.validation_status,
		n?.validation_status
	];
	return r.includes("rejected") ? "rejected" : r.includes("manual_review") ? "review_required" : r.every((e) => e === "auto_verified" || e === "approved") ? "verified" : "pending";
}
//#endregion
//#region src/api/projects.ts
var G = new P();
G.get("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT p.*, d.company_name as developer_name, d.contact_name, d.email as developer_email \n     FROM projects p LEFT JOIN developers d ON p.developer_id = d.id WHERE p.id = ?").bind(t).first();
	if (!n) return e.json({ error: "Not found" }, 404);
	let { results: r } = await e.env.DB.prepare("SELECT * FROM units WHERE project_id = ? ORDER BY unit_number").bind(t).all(), { results: i } = await e.env.DB.prepare("SELECT * FROM documents WHERE entity_type = ? AND entity_id = ?").bind("project", t).all();
	return e.json({
		project: n,
		units: r,
		documents: i
	});
}), G.post("/", async (e) => {
	let t = await e.req.json(), n = R("proj"), r = t.code || `PROJ-${Date.now().toString(36).toUpperCase()}`, i = z();
	return await e.env.DB.prepare("\n    INSERT INTO projects (id, developer_id, name, code, location, governorate, type, total_units, available_units, geo_json, status, created_at, updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, t.developer_id || "d001", t.name, r, t.location, t.governorate || "Muscat", t.type || "villa", t.total_units || 0, t.total_units || 0, t.geo_json || "{}", "draft", i, i).run(), await B(e.env.DB, {
		userId: t.user_id || "u010",
		userName: "Ahmed Al-Hinai",
		userRole: "developer",
		action: "PROJECT_CREATED",
		entityType: "project",
		entityId: n,
		details: {
			name: t.name,
			units: t.total_units
		}
	}), e.json({
		id: n,
		code: r,
		success: !0
	});
}), G.post("/:id/publish", async (e) => {
	let t = e.req.param("id"), n = await e.req.json().catch(() => ({})), r = z();
	return await e.env.DB.prepare("UPDATE projects SET status = ?, listing_visible = 1, green_eligible = 1, updated_at = ? WHERE id = ?").bind("active", r, t).run(), await B(e.env.DB, {
		userId: n.user_id || "u010",
		userName: "Ahmed Al-Hinai",
		userRole: "developer",
		action: "PROJECT_PUBLISHED",
		entityType: "project",
		entityId: t,
		details: { listing_visible: !0 }
	}), e.json({
		success: !0,
		listing_visible: !0
	});
}), G.get("/:id/units", async (e) => {
	let t = e.req.param("id"), { results: n } = await e.env.DB.prepare("SELECT * FROM units WHERE project_id = ? ORDER BY unit_number").bind(t).all();
	return e.json({ units: n });
}), G.post("/:id/units", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = R("unit"), i = z();
	return await e.env.DB.prepare("\n    INSERT INTO units (id, project_id, unit_number, type, area_sqm, bedrooms, bathrooms, price, lat, lng, status, features, created_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(r, t, n.unit_number, n.type || "villa", n.area_sqm || 0, n.bedrooms || 3, n.bathrooms || 2, n.price || 0, n.lat || 0, n.lng || 0, n.status || "available", n.features || "[]", i).run(), e.json({
		id: r,
		success: !0
	});
}), G.post("/:id/update-meta", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z(), i = [], a = [];
	for (let e of [
		"hero_image_url",
		"marketing_tagline",
		"price_from",
		"price_to",
		"completion_date",
		"amenities",
		"gsas_score",
		"gsas_rating",
		"epc_rating",
		"eia_reference",
		"green_eligible",
		"premium_tier",
		"listing_visible"
	]) n[e] !== void 0 && (i.push(`${e}=?`), a.push(n[e]));
	return i.length ? (a.push(r, t), await e.env.DB.prepare(`UPDATE projects SET ${i.join(",")}, updated_at=? WHERE id=?`).bind(...a).run(), e.json({ success: !0 })) : e.json({ success: !0 });
}), G.get("/units/:unitId", async (e) => {
	let t = e.req.param("unitId"), n = await e.env.DB.prepare("SELECT u.*, p.name as project_name, p.gsas_score, p.gsas_rating, p.location, p.eia_reference,\n     d.company_name as developer_name FROM units u \n     LEFT JOIN projects p ON u.project_id = p.id \n     LEFT JOIN developers d ON p.developer_id = d.id WHERE u.id = ?").bind(t).first();
	return n ? e.json({ unit: n }) : e.json({ error: "Not found" }, 404);
});
//#endregion
//#region src/api/documents.ts
var Je = new P();
Je.post("/analyze", async (e) => {
	let { doc_type: t, filename: n, entity_id: r, entity_type: i = "project", user_id: a = "system" } = await e.req.json(), o = Ye(t, n), s = R("doc"), c = z();
	return await e.env.DB.prepare("\n    INSERT INTO documents (id, entity_type, entity_id, doc_type, filename, extracted_data, ai_confidence, validation_status, validation_notes, created_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?)\n  ").bind(s, i, r, t, n, JSON.stringify(o.extracted_fields), o.ai_confidence, o.overall_status, o.recommendation, c).run(), await B(e.env.DB, {
		userId: "system",
		userName: "System AI",
		userRole: "system",
		action: o.overall_status === "auto_verified" ? "DOCUMENT_AUTO_VERIFIED" : "DOCUMENT_FLAGGED_REVIEW",
		entityType: "document",
		entityId: s,
		details: {
			doc_type: t,
			confidence: o.ai_confidence,
			status: o.overall_status
		},
		source: "ai_generated",
		aiConfidence: o.ai_confidence
	}), e.json({
		...o,
		document_id: s
	});
}), Je.patch("/:id/override", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z();
	return await e.env.DB.prepare("\n    UPDATE documents SET validation_status = 'approved', validation_notes = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?\n  ").bind(`Manual override: ${n.reason}`, n.user_id, r, t).run(), await B(e.env.DB, {
		userId: n.user_id || "u002",
		userName: n.user_name || "Aisha Al-Balushi",
		userRole: "compliance_officer",
		action: "DOCUMENT_OVERRIDE",
		entityType: "document",
		entityId: t,
		details: {
			action: "Override AI Confidence",
			reason: n.reason
		},
		regulatoryReference: n.regulatory_reference
	}), e.json({ success: !0 });
});
function Ye(e, t) {
	let n = {
		gsas_cert: {
			doc_type: "gsas_cert",
			extracted_fields: {
				certificate_number: "GSAS-2026-078",
				issuer: "GORD (Gulf Organisation for Research & Development)",
				issue_date: "2026-02-15",
				expiry_date: "2028-12-31",
				overall_score: 89,
				rating: "Gold",
				property: "EcoVillage Muscat"
			},
			validation_results: [
				{
					field: "Certificate Number",
					value: "GSAS-2026-078",
					status: "pass",
					message: "Valid format ✓"
				},
				{
					field: "Issuer",
					value: "GORD",
					status: "pass",
					message: "Accredited issuer ✓"
				},
				{
					field: "Valid Until",
					value: "31 Dec 2028",
					status: "pass",
					message: "28 months remaining ✓"
				},
				{
					field: "GSAS Score",
					value: "89 / 100",
					status: "pass",
					message: "Exceeds minimum (70). Premium tier qualifies for 0.75% discount ✓"
				},
				{
					field: "Rating",
					value: "Gold",
					status: "pass",
					message: "Gold rating accepted ✓"
				}
			],
			overall_status: "auto_verified",
			ai_confidence: 96,
			confidence_reason: "High-quality PDF scan. All mandatory fields clearly extracted.",
			recommendation: "✅ Auto-Verified. GSAS score 89 qualifies for Premium Green Discount (0.75%). No manual review required."
		},
		epc_report: {
			doc_type: "epc_report",
			extracted_fields: {
				rating: "A",
				expiry_date: "2027-05-01",
				property_ref: "EVM-B1",
				energy_consumption: "85 kWh/m²/year",
				co2_rating: "A",
				assessor: "Green Build Oman"
			},
			validation_results: [
				{
					field: "EPC Rating",
					value: "A (Excellent)",
					status: "pass",
					message: "Exceeds minimum requirement (C) ✓"
				},
				{
					field: "Expiry Date",
					value: "May 2027",
					status: "pass",
					message: "8+ months remaining ✓"
				},
				{
					field: "Assessor",
					value: "Green Build Oman",
					status: "pass",
					message: "OEESC accredited ✓"
				},
				{
					field: "Image Quality",
					value: "Slightly skewed",
					status: "warning",
					message: "⚠ Confidence reduced to 88% due to image quality"
				}
			],
			overall_status: "manual_review",
			ai_confidence: 88,
			confidence_reason: "Slight image skew reduced field extraction confidence below 90% auto-verify threshold.",
			recommendation: "⚠️ Manual Review Recommended. Confidence: 88%. Rating A confirmed; expiry 2027 acceptable. Quick visual check advised."
		},
		eia_approval: {
			doc_type: "eia_approval",
			extracted_fields: {
				reference: "EIA/2026/442",
				issuer: "Environment Authority – Oman",
				approval_date: "2026-03-10",
				valid_until: "2029-03-10",
				project: "EcoVillage Muscat",
				units: 24,
				status: "Approved"
			},
			validation_results: [
				{
					field: "Reference Number",
					value: "EIA/2026/442",
					status: "pass",
					message: "Valid EIA reference format ✓"
				},
				{
					field: "Issuer Authority",
					value: "Environment Authority",
					status: "pass",
					message: "Official Oman issuing body ✓"
				},
				{
					field: "Validity",
					value: "2029-03-10",
					status: "pass",
					message: "31 months remaining ✓"
				},
				{
					field: "Units Coverage",
					value: "24 units (all covered)",
					status: "pass",
					message: "All project units included ✓"
				}
			],
			overall_status: "auto_verified",
			ai_confidence: 95,
			confidence_reason: "Clear document. All required fields extracted with high confidence.",
			recommendation: "✅ Auto-Verified. EIA clearance confirmed for all 24 units. Issued by Environment Authority."
		},
		invoice: {
			doc_type: "invoice",
			extracted_fields: {
				material: "Green Concrete – C30 Grade",
				total_amount: "OMR 12,000",
				supplier: "Oman Readymix LLC",
				invoice_date: "2026-08-28",
				invoice_number: "INV-2026-08-4471"
			},
			validation_results: [
				{
					field: "Material",
					value: "Green Concrete – C30 Grade",
					status: "pass",
					message: "Approved green material ✓"
				},
				{
					field: "Supplier",
					value: "Oman Readymix LLC",
					status: "pass",
					message: "Pre-approved vendor ✓"
				},
				{
					field: "Amount",
					value: "OMR 12,000",
					status: "pass",
					message: "Within expected range ✓"
				},
				{
					field: "Invoice Date",
					value: "2026-08-28",
					status: "pass",
					message: "Valid date ✓"
				}
			],
			overall_status: "auto_verified",
			ai_confidence: 94,
			confidence_reason: "All OCR fields extracted clearly. Material and vendor match approved lists.",
			recommendation: "✅ Invoice Auto-Verified. Green material confirmed. Stage 1 completion payment authorised."
		},
		civil_id: {
			doc_type: "civil_id",
			extracted_fields: {
				name: "Salim Hassan Al-Harthy",
				civil_id_number: "84521789",
				dob: "1989-03-15",
				nationality: "Omani",
				expiry: "2029-03-14"
			},
			validation_results: [
				{
					field: "Name",
					value: "Salim Hassan Al-Harthy",
					status: "pass",
					message: "Matches profile ✓"
				},
				{
					field: "Civil ID",
					value: "84521789",
					status: "pass",
					message: "Valid format ✓"
				},
				{
					field: "Nationality",
					value: "Omani",
					status: "pass",
					message: "Eligible for home financing ✓"
				},
				{
					field: "Expiry",
					value: "2029-03-14",
					status: "pass",
					message: "30+ months remaining ✓"
				}
			],
			overall_status: "auto_verified",
			ai_confidence: 98,
			confidence_reason: "High resolution scan. MRZ line verified.",
			recommendation: "✅ Civil ID Auto-Verified. Identity confirmed."
		}
	};
	return n[e] || n.civil_id;
}
//#endregion
//#region src/api/escrow.ts
var Xe = new P();
Xe.post("/:appId/complete-stage", async (e) => {
	e.req.param("appId");
	let { stage_id: t, invoice_filename: n, user_id: r = "u011", user_name: i = "Rashid Al-Hassani" } = await e.req.json(), a = z();
	return await e.env.DB.prepare("\n    UPDATE construction_stages SET status = 'completed', ai_validated = 1, ai_confidence = 94, completed_at = ? WHERE id = ?\n  ").bind(a, t).run(), await B(e.env.DB, {
		userId: r,
		userName: i,
		userRole: "contractor",
		action: "STAGE_COMPLETED",
		entityType: "construction_stage",
		entityId: t,
		details: {
			invoice: n,
			ai_confidence: 94,
			material_verified: "Green Concrete"
		},
		source: "ai_generated",
		aiConfidence: 94
	}), e.json({
		success: !0,
		invoice_validation: {
			ocr_extracted: {
				material: "Green Concrete – C30 Grade",
				total_amount: "OMR 12,000",
				supplier: "Oman Readymix LLC",
				invoice_date: "2026-08-28",
				invoice_number: "INV-2026-08-4471"
			},
			validation_results: [
				{
					check: "Material",
					value: "Green Concrete – C30 Grade",
					status: "pass",
					icon: "✅",
					detail: "Approved material"
				},
				{
					check: "Supplier",
					value: "Oman Readymix LLC",
					status: "pass",
					icon: "✅",
					detail: "Pre-approved vendor"
				},
				{
					check: "Amount",
					value: "OMR 12,000",
					status: "pass",
					icon: "✅",
					detail: "Within expected range"
				},
				{
					check: "Invoice Date",
					value: "2026-08-28",
					status: "pass",
					icon: "✅",
					detail: "Valid date"
				}
			],
			overall_status: "auto_verified",
			ai_confidence: 94,
			recommendation: "Stage 1 completion verified. Green material confirmed. Payment initiation in progress."
		}
	});
}), Xe.post("/:appId/release-tranche", async (e) => {
	let t = e.req.param("appId"), { stage_id: n, amount: r, user_id: i = "u004", user_name: a = "Khalid Al-Rawahi" } = await e.req.json(), o = z(), s = `TRX-${(/* @__PURE__ */ new Date()).getFullYear()}-${String((/* @__PURE__ */ new Date()).getMonth() + 1).padStart(2, "0")}-${String((/* @__PURE__ */ new Date()).getDate()).padStart(2, "0")}-${Math.floor(Math.random() * 9e3 + 1e3)}`;
	await e.env.DB.prepare("\n    UPDATE construction_stages SET status = 'paid', payment_reference = ?, paid_at = ? WHERE id = ?\n  ").bind(s, o, n).run();
	let c = await e.env.DB.prepare("SELECT * FROM construction_stages WHERE id = ?").bind(n).first();
	return c && await e.env.DB.prepare("\n      UPDATE construction_stages SET status = 'active' \n      WHERE application_id = ? AND stage_number = ? AND status = 'locked'\n    ").bind(t, c.stage_number + 1).run(), await e.env.DB.prepare("\n    UPDATE applications SET escrow_released = escrow_released + ?, status = 'disbursed', updated_at = ? WHERE id = ?\n  ").bind(r, o, t).run(), await B(e.env.DB, {
		userId: i,
		userName: a,
		userRole: "operations",
		action: "ESCROW_TRANCHE_RELEASED",
		entityType: "application",
		entityId: t,
		details: {
			stage_id: n,
			amount: r,
			transaction_reference: s
		}
	}), e.json({
		success: !0,
		transaction_reference: s,
		amount_released: r
	});
});
//#endregion
//#region src/api/audit.ts
var Ze = new P(), K = new P();
K.get("/", async (e) => {
	let { results: t } = await e.env.DB.prepare("SELECT id, name, name_ar, email, role, department, avatar_initials, status\n     FROM users WHERE status != 'inactive' ORDER BY id").all();
	return e.json({ users: t });
}), K.get("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(t).first();
	return n ? e.json({ user: n }) : e.json({ error: "Not found" }, 404);
}), K.get("/customer/:customerId", async (e) => {
	let t = e.req.param("customerId"), n = await e.env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(t).first();
	if (!n) return e.json({ error: "Not found" }, 404);
	let { results: r } = await e.env.DB.prepare("SELECT a.*, p.name as product_name FROM applications a LEFT JOIN products p ON a.product_id = p.id WHERE a.customer_id = ? ORDER BY a.created_at DESC").bind(t).all();
	return e.json({
		customer: n,
		applications: r
	});
});
//#endregion
//#region src/api/seed.ts
var Qe = new P(), $e = "\nCREATE TABLE IF NOT EXISTS products (\n  id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT UNIQUE, description TEXT,\n  category TEXT DEFAULT 'home_loan', status TEXT DEFAULT 'draft',\n  base_rate REAL DEFAULT 5.5, max_ltv INTEGER DEFAULT 90, max_dbr INTEGER DEFAULT 60,\n  green_dbr INTEGER DEFAULT 55, min_term INTEGER DEFAULT 5, max_term INTEGER DEFAULT 25,\n  min_amount REAL DEFAULT 10000, max_amount REAL DEFAULT 500000,\n  gsas_min_score INTEGER DEFAULT 0, gsas_premium_score INTEGER DEFAULT 0,\n  green_discount_premium REAL DEFAULT 0.0, green_discount_standard REAL DEFAULT 0.0,\n  ai_confidence_threshold INTEGER DEFAULT 90, allow_byop INTEGER DEFAULT 1,\n  allow_partner_inventory INTEGER DEFAULT 1,\n  required_docs TEXT DEFAULT '[]', esg_required_docs TEXT DEFAULT '[]',\n  approved_materials TEXT DEFAULT '[]', approved_vendors TEXT DEFAULT '[]',\n  configuration TEXT DEFAULT '{}', applications_ytd INTEGER DEFAULT 0,\n  created_by TEXT DEFAULT 'system', created_at TEXT DEFAULT (datetime('now')),\n  updated_at TEXT DEFAULT (datetime('now')),\n  portal_visible INTEGER DEFAULT 0,\n  portal_hero_title TEXT, portal_hero_subtitle TEXT, portal_card_badge TEXT,\n  portal_highlights TEXT DEFAULT '[]',\n  portal_calculator_enabled INTEGER DEFAULT 1,\n  developer_portal_visible INTEGER DEFAULT 0,\n  developer_requirements TEXT DEFAULT '{}',\n  published_at TEXT\n);\n\nCREATE TABLE IF NOT EXISTS rules (\n  id TEXT PRIMARY KEY, product_id TEXT, name TEXT NOT NULL, category TEXT NOT NULL,\n  metric TEXT NOT NULL, operator TEXT NOT NULL, threshold_value REAL,\n  threshold_condition TEXT, action_on_breach TEXT DEFAULT 'reject',\n  severity TEXT DEFAULT 'hard', regulatory_reference TEXT,\n  source TEXT DEFAULT 'manual', ai_confidence REAL, description TEXT,\n  is_active INTEGER DEFAULT 1, created_by TEXT DEFAULT 'system',\n  created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS developers (\n  id TEXT PRIMARY KEY, company_name TEXT NOT NULL, cr_number TEXT UNIQUE,\n  contact_name TEXT, email TEXT, phone TEXT, po_box TEXT,\n  status TEXT DEFAULT 'active', verified_at TEXT, created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS projects (\n  id TEXT PRIMARY KEY, developer_id TEXT, name TEXT NOT NULL, code TEXT UNIQUE,\n  location TEXT, governorate TEXT, type TEXT DEFAULT 'residential',\n  total_units INTEGER DEFAULT 0, available_units INTEGER DEFAULT 0,\n  reserved_units INTEGER DEFAULT 0, sold_units INTEGER DEFAULT 0,\n  gsas_score INTEGER, gsas_rating TEXT, epc_rating TEXT, eia_reference TEXT,\n  geo_json TEXT, status TEXT DEFAULT 'draft',\n  green_eligible INTEGER DEFAULT 0, premium_tier INTEGER DEFAULT 0,\n  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS units (\n  id TEXT PRIMARY KEY, project_id TEXT, unit_number TEXT NOT NULL,\n  floor_number INTEGER, type TEXT DEFAULT 'villa', area_sqm REAL,\n  bedrooms INTEGER, bathrooms INTEGER, price REAL, lat REAL, lng REAL,\n  status TEXT DEFAULT 'available', features TEXT DEFAULT '[]',\n  created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS documents (\n  id TEXT PRIMARY KEY, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,\n  doc_type TEXT NOT NULL, filename TEXT, file_url TEXT,\n  extracted_data TEXT DEFAULT '{}', ai_confidence REAL,\n  validation_status TEXT DEFAULT 'pending', validation_notes TEXT,\n  reviewed_by TEXT, reviewed_at TEXT, created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS customers (\n  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT, civil_id TEXT UNIQUE,\n  email TEXT, phone TEXT, nationality TEXT DEFAULT 'Omani', employer TEXT,\n  salary_omr REAL, employment_type TEXT DEFAULT 'salaried',\n  credit_score INTEGER DEFAULT 700, existing_dbr REAL DEFAULT 0,\n  sohar_customer_since TEXT, status TEXT DEFAULT 'active',\n  created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS applications (\n  id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, product_id TEXT,\n  customer_id TEXT, customer_name TEXT, unit_id TEXT, project_id TEXT,\n  loan_amount REAL, loan_term INTEGER, property_address TEXT,\n  property_source TEXT DEFAULT 'partner', property_area_sqm REAL,\n  gsas_score INTEGER, epc_rating TEXT, applied_rate REAL, standard_rate REAL DEFAULT 5.5,\n  monthly_payment REAL, standard_monthly_payment REAL, lifetime_saving REAL,\n  dbr REAL, ltv REAL, stress_test_rate REAL DEFAULT 9.0, stress_test_passed INTEGER DEFAULT 0,\n  malaa_score INTEGER, status TEXT DEFAULT 'draft', esg_verification_status TEXT DEFAULT 'pending',\n  compliance_approved_by TEXT, compliance_approved_at TEXT,\n  risk_approved_by TEXT, risk_approved_at TEXT,\n  escrow_amount REAL, escrow_released REAL DEFAULT 0,\n  rejection_reason TEXT, tracking_url TEXT,\n  created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS construction_stages (\n  id TEXT PRIMARY KEY, application_id TEXT, stage_number INTEGER NOT NULL,\n  stage_name TEXT NOT NULL, description TEXT, tranche_amount REAL,\n  tranche_percentage REAL, required_material TEXT, status TEXT DEFAULT 'locked',\n  invoice_doc_id TEXT, ai_validated INTEGER DEFAULT 0, ai_confidence REAL,\n  payment_reference TEXT, completed_at TEXT, paid_at TEXT,\n  created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS users (\n  id TEXT PRIMARY KEY, name TEXT NOT NULL, name_ar TEXT, email TEXT UNIQUE NOT NULL,\n  role TEXT NOT NULL, department TEXT, avatar_initials TEXT,\n  status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS audit_logs (\n  id TEXT PRIMARY KEY, user_id TEXT, user_name TEXT, user_role TEXT,\n  action TEXT NOT NULL, entity_type TEXT, entity_id TEXT, details TEXT DEFAULT '{}',\n  source TEXT DEFAULT 'manual', ai_confidence REAL, regulatory_reference TEXT,\n  ip_address TEXT, created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS knowledge_base (\n  id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL,\n  content TEXT NOT NULL, source TEXT, effective_date TEXT,\n  tags TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE TABLE IF NOT EXISTS rule_templates (\n  id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,\n  regulatory_source TEXT, template_json TEXT NOT NULL,\n  is_cbo_required INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))\n);\n\nCREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);\nCREATE INDEX IF NOT EXISTS idx_applications_reference ON applications(reference);\nCREATE INDEX IF NOT EXISTS idx_units_project ON units(project_id);\nCREATE INDEX IF NOT EXISTS idx_documents_entity ON documents(entity_type, entity_id);\nCREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);\nCREATE INDEX IF NOT EXISTS idx_construction_stages_app ON construction_stages(application_id);\n", et = "\nALTER TABLE products ADD COLUMN portal_visible INTEGER DEFAULT 0;\nALTER TABLE products ADD COLUMN portal_hero_title TEXT;\nALTER TABLE products ADD COLUMN portal_hero_subtitle TEXT;\nALTER TABLE products ADD COLUMN portal_card_badge TEXT;\nALTER TABLE products ADD COLUMN portal_highlights TEXT DEFAULT '[]';\nALTER TABLE products ADD COLUMN portal_calculator_enabled INTEGER DEFAULT 1;\nALTER TABLE products ADD COLUMN developer_portal_visible INTEGER DEFAULT 0;\nALTER TABLE products ADD COLUMN developer_requirements TEXT DEFAULT '{}';\nALTER TABLE products ADD COLUMN published_at TEXT;\nALTER TABLE projects ADD COLUMN listing_visible INTEGER DEFAULT 0;\nALTER TABLE projects ADD COLUMN hero_image_url TEXT;\nALTER TABLE projects ADD COLUMN marketing_tagline TEXT;\nALTER TABLE projects ADD COLUMN price_from REAL;\nALTER TABLE projects ADD COLUMN price_to REAL;\nALTER TABLE projects ADD COLUMN completion_date TEXT;\nALTER TABLE projects ADD COLUMN amenities TEXT DEFAULT '[]';\nCREATE TABLE IF NOT EXISTS ai_threads (\n  id TEXT PRIMARY KEY, user_id TEXT, product_id TEXT, purpose TEXT NOT NULL,\n  messages TEXT DEFAULT '[]', context TEXT DEFAULT '{}', status TEXT DEFAULT 'active',\n  result TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))\n);\n", tt = "\nINSERT OR IGNORE INTO users VALUES ('u001','Fatima Al-Rashdi','فاطمة الراشدي','fatima@sib.om','product_manager','Product Management','FA','active','2024-01-15');\nINSERT OR IGNORE INTO users VALUES ('u002','Aisha Al-Balushi','عائشة البلوشي','aisha@sib.om','compliance_officer','Compliance & ESG','AB','active','2023-06-01');\nINSERT OR IGNORE INTO users VALUES ('u003','Omar Al-Mantheri','عمر المنذري','omar@sib.om','risk_officer','Credit Risk','OM','active','2023-03-15');\nINSERT OR IGNORE INTO users VALUES ('u004','Khalid Al-Rawahi','خالد الرواحي','khalid@sib.om','operations','Operations','KR','active','2022-09-01');\nINSERT OR IGNORE INTO users VALUES ('u010','Ahmed Al-Hinai','أحمد الهنائي','ahmed@almadaen.om','developer','Al Madaen Real Estate','AH','active','2023-11-01');\nINSERT OR IGNORE INTO users VALUES ('u011','Rashid Al-Hassani','راشد الحساني','rashid@aljazeera-const.om','contractor','Al Jazeera Constructions','RH','active','2024-02-01');\nINSERT OR IGNORE INTO users VALUES ('u020','Salim Al-Harthy','سالم الحارثي','salim@gmail.com','customer',null,'SH','active','2019-05-10');\n\nINSERT OR IGNORE INTO customers VALUES ('c001','Salim Al-Harthy','سالم الحارثي','84521789','salim@gmail.com','+968 9921 3344','Omani','Ministry of Heritage & Tourism',3200,'salaried',750,0,'2019-05-10','active','2019-05-10');\nINSERT OR IGNORE INTO customers VALUES ('c002','Mariam Al-Siyabi','مريم السيابي','91234567','mariam@hotmail.com','+968 9955 1122','Omani','Oman Oil Company',4500,'salaried',780,12,'2020-03-22','active','2020-03-22');\nINSERT OR IGNORE INTO customers VALUES ('c003','Hassan Al-Amri','حسن العامري','78654321','hassan@gmail.com','+968 9977 8899','Omani','Bank Muscat',2800,'salaried',710,18,'2021-07-15','active','2021-07-15');\n\nINSERT OR IGNORE INTO products VALUES ('p001','Standard Home Loan','SHL-STANDARD','Flagship home financing for Omani nationals and residents. Fixed and variable rate options, top-up facility, and bundled insurance. CBO-compliant with full credit assessment.','home_loan','active',5.5,90,60,60,5,25,10000,500000,0,0,0.0,0.0,90,1,1,'[\"civil_id\",\"salary_certificate\",\"utility_bill\",\"property_deed\",\"independent_valuation_report\",\"bank_statements_3m\",\"employer_letter\"]','[]','[]','[]','{\"features\":[\"Fixed and variable rate options\",\"Top-up facility available\",\"Insurance bundled\",\"Salary transfer preferred\"]}',4847,'u001','2024-01-10','2025-12-15');\nINSERT OR IGNORE INTO products VALUES ('p002','Auto Finance – Personal','AFL-PERSONAL','Financing for personal vehicles including sedans, SUVs, and electric vehicles. Competitive flat rate, quick 48-hour approval, covers new and used vehicles up to 5 years old.','auto_loan','active',4.9,85,55,55,1,7,3000,80000,0,0,0.0,0.0,90,0,0,'[\"civil_id\",\"salary_certificate\",\"vehicle_proforma_invoice\",\"driving_license\",\"insurance_quotation\",\"bank_statements_3m\"]','[]','[]','[]','{\"features\":[\"Covers new & used vehicles\",\"48-hour credit decision\",\"EV purchase supported\",\"Comprehensive insurance required\"]}',1923,'u001','2023-06-01','2025-11-20');\nINSERT OR IGNORE INTO products VALUES ('p003','Personal Loan','PL-UNSECURED','Unsecured personal financing for salaried employees of approved employers. No collateral required. Flat competitive rate for medical, travel, home renovation and other personal needs.','personal_loan','active',7.5,0,45,45,1,5,1000,30000,0,0,0.0,0.0,90,0,0,'[\"civil_id\",\"salary_certificate\",\"employer_letter\",\"bank_statements_3m\",\"approved_employer_confirmation\"]','[]','[]','[]','{\"features\":[\"No collateral required\",\"Approved employer list\",\"Competitive fixed rate\",\"Loan protector insurance available\"]}',3241,'u001','2023-01-15','2025-10-01');\nINSERT OR IGNORE INTO products VALUES ('p004','SME Working Capital','SME-WORKCAP','Short-term working capital facility for small and medium enterprises registered in Oman. Revolving or term structure. Supports payroll, inventory procurement, and operational growth.','sme','active',6.5,70,65,65,1,3,5000,200000,0,0,0.0,0.0,85,0,0,'[\"commercial_registration_certificate\",\"memorandum_of_association\",\"audited_financials_2yr\",\"bank_statements_6m\",\"cr_extract\",\"tax_clearance_certificate\",\"business_profile\"]','[]','[]','[]','{\"features\":[\"For Oman-registered SMEs\",\"Revolving or term facility\",\"Supports payroll & growth\",\"MOCI-verified CR required\"]}',892,'u001','2023-08-10','2025-09-15');\nINSERT OR IGNORE INTO products VALUES ('p005','Home Equity Line','HELOC-STANDARD','Revolving credit facility secured against existing owned property. Access equity without selling. Ideal for large purchases, education, or business funding. Second charge behind primary mortgage.','home_loan','active',6.0,75,55,55,5,15,20000,300000,0,0,0.0,0.0,90,0,0,'[\"civil_id\",\"property_title_deed\",\"independent_valuation_report\",\"salary_certificate\",\"bank_statements_3m\",\"existing_mortgage_statement\",\"noc_from_primary_lender\"]','[]','[]','[]','{\"features\":[\"Use your property equity\",\"Revolving credit line\",\"Up to OMR 300,000\",\"No early settlement penalty\"]}',567,'u001','2024-03-01','2025-08-20');\nINSERT OR IGNORE INTO products VALUES ('p006','Commercial Property Finance','CPF-COMMERCIAL','Financing for commercial properties including offices, retail units, and warehouses. Available to Omani-registered companies and sole proprietors. Full corporate credit assessment applies.','commercial','active',6.8,70,65,65,5,20,50000,2000000,0,0,0.0,0.0,85,0,0,'[\"commercial_registration_certificate\",\"memorandum_of_association\",\"audited_financials_3yr\",\"bank_statements_12m\",\"property_title_deed\",\"independent_valuation_report\",\"lease_agreements\",\"board_resolution\"]','[]','[]','[]','{\"features\":[\"For offices, retail & warehouses\",\"Up to OMR 2,000,000\",\"Flexible repayment structures\",\"Lease income considered\"]}',234,'u001','2023-09-01','2025-07-10');\nINSERT OR IGNORE INTO products VALUES ('p007','Expat Home Finance','EHL-EXPAT','Home financing for expatriate professionals working in Oman. Stricter LTV (max 75%) per CBO regulations. Employer NOC required. Available for IZ-approved freehold zones.','home_loan','active',6.0,75,55,55,5,20,15000,400000,0,0,0.0,0.0,90,0,0,'[\"civil_id\",\"passport_copy\",\"valid_work_permit_residence_card\",\"salary_certificate\",\"noc_from_employer\",\"property_deed_freehold_zone\",\"independent_valuation_report\",\"bank_statements_6m\"]','[]','[]','[]','{\"features\":[\"Expatriate professionals\",\"LTV up to 75%\",\"Freehold zone properties\",\"Employer NOC required\"]}',1102,'u001','2024-01-20','2025-12-01');\nINSERT OR IGNORE INTO products VALUES ('p008','Education Finance','EDU-FINANCE','Financing for higher education expenses including tuition, accommodation, and study materials at approved universities in Oman and abroad. Deferred repayment option available.','education','archived',8.0,0,45,45,1,8,500,20000,0,0,0.0,0.0,90,0,0,'[\"civil_id\",\"university_offer_letter_or_enrollment\",\"salary_certificate\",\"fee_schedule_from_institution\",\"bank_statements_3m\"]','[]','[]','[]','{\"features\":[\"Approved universities list\",\"Deferred repayment option\",\"Covers tuition & accommodation\",\"Loan protector insurance\"]}',445,'u001','2022-01-01','2024-06-01');\n-- Green Home Loan is created LIVE during the presentation (Act 1).\n\nINSERT OR IGNORE INTO rules VALUES ('r001',null,'DBR Maximum Limit','creditworthiness','DBR','<=',60,null,'reject','hard','CBO Circular 2024-01, Section 3.1','manual',null,'Debt Burden Ratio must not exceed 60% of gross monthly income',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r002',null,'LTV Maximum – Salaried Omani','collateral','LTV','<=',90,'nationality=Omani AND employment=salaried','reject','hard','CBO Circular 2024-01, Section 4.2','manual',null,'LTV max 90% for salaried Omani nationals',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r003',null,'LTV Maximum – Expat','collateral','LTV','<=',75,'nationality!=Omani','reject','hard','CBO Circular 2024-01, Section 4.3','manual',null,'LTV max 75% for expatriates',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r004',null,'Minimum Loan Term','product','loan_term','>=',5,null,'reject','hard','Bank Policy BP-2024-HL-001','manual',null,'Minimum loan term 5 years',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r005',null,'Maximum Loan Term','product','loan_term','<=',25,null,'reject','hard','CBO Circular 2024-01, Section 5.1','manual',null,'Maximum loan term 25 years',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r006',null,'Minimum Credit Score','creditworthiness','credit_score','>=',650,null,'reject','hard','Bank Policy BP-2024-CR-002','manual',null,'Minimum MALAA credit score 650',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r007',null,'CBO Stress Test – Rate Hike','stress_test','stress_rate','<=',9,null,'reject','hard','CBO Circular 2025-07, Section 2.3','manual',null,'Simulate +350bps rate hike; DBR must not exceed 70%',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r008',null,'Minimum Salary – Home Loan','eligibility','salary_omr','>=',400,null,'reject','soft','Bank Policy BP-2024-HL-003','manual',null,'Minimum monthly salary OMR 400',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r009',null,'Property Valuation Required','collateral','valuation_required','=',1,null,'reject','hard','CBO Circular 2024-01, Section 6.1','manual',null,'Independent valuation mandatory',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r010',null,'AML Sanctions Screening','compliance','sanctions_clear','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 8','manual',null,'Customer must pass sanctions screening',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r011',null,'KYC Completeness Check','compliance','kyc_complete','=',1,null,'reject','hard','CBO AML/CFT Rules 2022, Section 5.2','manual',null,'All KYC documents must be verified',1,'system','2024-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r012',null,'GSAS Score – Green Entry','esg','gsas_score','>=',70,null,'reject','hard','OS GSO 3000:2025, Section 4.2','manual',null,'Minimum GSAS score 70 for Green Home Loan',1,'system','2026-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r013',null,'EPC Rating Minimum','esg','epc_rating','in',null,'A,B,C','reject','hard','OEESC Section 5.1','manual',null,'EPC minimum rating C required',1,'system','2026-01-01');\nINSERT OR IGNORE INTO rules VALUES ('r014',null,'EIA Clearance – Large Projects','esg','eia_required','=',1,'units>20','reject','hard','Environment Authority Decision 107/2023','manual',null,'EIA clearance mandatory for >20 units',1,'system','2026-01-01');\n-- r015 (Green DBR Buffer) is generated LIVE by AI during Act 1.\n\nINSERT OR IGNORE INTO developers VALUES ('d001','Al Madaen Real Estate','CR-2019-45821','Ahmed Al-Hinai','ahmed@almadaen.om','+968 2434 5566','PO Box 1234, Muscat','active','2023-11-15','2019-03-01');\nINSERT OR IGNORE INTO developers VALUES ('d002','Muscat Hills Development','CR-2018-33201','Sara Al-Lawati','sara@muscathills.om','+968 2488 9900','PO Box 567, Muscat','active','2022-09-20','2018-07-10');\nINSERT OR IGNORE INTO developers VALUES ('d003','Gulf Horizon Properties','CR-2021-78543','Khalid Al-Farsi','khalid@gulfhorizon.om','+968 2456 7788','PO Box 890, Sohar','active','2024-01-05','2021-02-15');\n\nINSERT OR IGNORE INTO projects VALUES ('proj001','d001','Al Mouj Residences','AMR-2024','Al Mouj, Muscat','Muscat','apartment',36,12,8,16,78,'Gold','B','EIA/2024/201','{\"type\":\"FeatureCollection\",\"features\":[]}','active',1,0,'2024-06-15','2025-11-30',1,'/static/img/proj001_hero.jpg','Waterfront living with premium amenities in the heart of Muscat',95000,185000,NULL,'[\"Swimming Pool\",\"Gym\",\"24/7 Security\",\"Covered Parking\",\"Children''s Play Area\"]');\nINSERT OR IGNORE INTO projects VALUES ('proj002','d001','Seeb Heights Villas','SHV-2025','Airport Heights, Seeb','Muscat','villa',18,18,0,0,82,'Gold','A',null,'{\"type\":\"FeatureCollection\",\"features\":[]}','active',1,0,'2025-01-10','2025-12-01',1,'/static/img/proj002_hero.jpg','Spacious villas with panoramic views near Muscat International Airport',145000,220000,NULL,'[\"Private Garden\",\"Rooftop Terrace\",\"Central A/C\",\"Smart Home\",\"Visitor Parking\"]');\nINSERT OR IGNORE INTO projects VALUES ('proj003','d001','Mabella View Apartments','MVA-2023','Mabella, Muscat','Muscat','apartment',60,0,0,60,null,null,null,null,'{\"type\":\"FeatureCollection\",\"features\":[]}','archived',0,0,'2023-05-01','2025-06-30',0,'/static/img/proj003_hero.jpg',null,null,null,null,'[]');\nINSERT OR IGNORE INTO projects VALUES ('proj004','d001','EcoVillage Muscat','EVM-2026','Seeb, Muscat Governorate','Muscat','villa',24,0,0,0,null,null,null,null,'{\"type\":\"FeatureCollection\",\"features\":[]}','draft',0,0,'2026-08-31','2026-08-31',0,'/static/img/proj004_hero.jpg',null,null,null,null,'[]');\n\n-- EcoVillage units and documents are uploaded LIVE during Act 2.\n\nINSERT OR IGNORE INTO applications VALUES ('app001','HL-240892','p001','c002','Mariam Al-Siyabi',null,'proj001',250000,20,'Al Mouj Residences, Unit A12, Muscat','partner',142,null,null,5.5,5.5,1608.82,1608.82,0,46,78,9.0,1,780,'approved','verified','u002','2024-09-15','u003','2024-09-16',250000,0,null,null,'2024-09-14','2024-09-16');\nINSERT OR IGNORE INTO applications VALUES ('app002','HL-241156','p001','c003','Hassan Al-Amri',null,null,120000,15,'Plot 45, Al Ghubra North, Muscat','byop',200,null,null,5.5,5.5,980.12,980.12,0,36,72,9.0,1,710,'credit_review','pending',null,null,null,null,120000,0,null,null,'2024-12-01','2024-12-03');\n-- GHL-250001 (app003) and construction stages are created LIVE during Acts 3-5.\n\nINSERT OR IGNORE INTO knowledge_base VALUES ('kb001','CBO Circular 2026-12 – DBR Rules','regulatory','The Central Bank of Oman requires DBR shall not exceed 60% of gross monthly income. For green financing, banks apply a 5% buffer, limiting DBR to 55%.','CBO Circular 2026-12','2026-01-01','[\"DBR\",\"housing\",\"green\"]','2026-08-31');\nINSERT OR IGNORE INTO knowledge_base VALUES ('kb002','OS GSO 3000:2025 – GSAS Standards','esg','GSAS certificates must contain: Certificate Number (GSAS-YYYY-NNN), Issuer (GORD), Issue Date, Expiry Date, Overall Score (0-100), Rating. Minimum score 70 for green financing.','OS GSO 3000:2025','2025-01-01','[\"GSAS\",\"ESG\",\"certification\"]','2026-08-31');\nINSERT OR IGNORE INTO knowledge_base VALUES ('kb003','Oman PDPL – Royal Decree 6/2022','compliance','PDPL requires explicit consent, secure storage, right to erasure, mandatory breach notification within 72 hours.','Royal Decree 6/2022','2022-02-01','[\"PDPL\",\"data\",\"privacy\"]','2026-08-31');\nINSERT OR IGNORE INTO knowledge_base VALUES ('kb004','OEESC – EPC Requirements','esg','Energy Performance Certificates required for all new residential developments. Minimum rating C for green financing. Scale A+ to G.','OEESC Section 5.1','2024-01-01','[\"EPC\",\"energy\",\"efficiency\"]','2026-08-31');\nINSERT OR IGNORE INTO knowledge_base VALUES ('kb005','Environment Authority Decision 107/2023','esg','EIA clearance mandatory for residential developments exceeding 20 units. Reference format: EIA/YYYY/NNN. Valid 3 years.','Environment Authority Decision 107/2023','2023-07-15','[\"EIA\",\"environment\",\"assessment\"]','2026-08-31');\n\nINSERT OR IGNORE INTO audit_logs VALUES ('al001','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p001','{\"status\":\"active\",\"product_name\":\"Standard Home Loan\"}','manual',null,null,'10.10.50.15','2024-01-10 09:00:00');\nINSERT OR IGNORE INTO audit_logs VALUES ('al002','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p002','{\"status\":\"active\",\"product_name\":\"Auto Finance - Personal\"}','manual',null,null,'10.10.50.15','2023-06-01 10:00:00');\nINSERT OR IGNORE INTO audit_logs VALUES ('al003','u002','Aisha Al-Balushi','compliance_officer','APPLICATION_APPROVED','application','app001','{\"reference\":\"HL-240892\",\"customer\":\"Mariam Al-Siyabi\",\"amount\":250000}','manual',null,'CBO Circular 2024-01','10.10.50.22','2024-09-15 14:30:00');\nINSERT OR IGNORE INTO audit_logs VALUES ('al004','u003','Omar Al-Mantheri','risk_officer','CREDIT_REVIEW_APPROVED','application','app001','{\"reference\":\"HL-240892\",\"dbr\":46,\"ltv\":78,\"stress_test\":\"passed\"}','manual',null,'CBO Circular 2024-01','10.10.50.33','2024-09-16 11:00:00');\n";
Qe.post("/run", async (e) => {
	let t = e.env.DB;
	try {
		let n = $e.split(";").map((e) => e.trim()).filter((e) => e.length > 0);
		for (let e of n) try {
			await t.prepare(e).run();
		} catch {}
		let r = et.split(";").map((e) => e.trim()).filter((e) => e.length > 0);
		for (let e of r) try {
			await t.prepare(e).run();
		} catch {}
		let i = tt.split(";").map((e) => e.trim()).filter((e) => e.length > 0 && !e.startsWith("--"));
		for (let e of i) try {
			await t.prepare(e).run();
		} catch {}
		return e.json({
			success: !0,
			message: "Seed data applied successfully. All tables and reference data are in place."
		});
	} catch (t) {
		return e.json({
			success: !1,
			error: t.message
		}, 500);
	}
}), Qe.post("/reset-demo", async (e) => {
	let t = e.env.DB, n = [
		"p001",
		"p002",
		"p003",
		"p004",
		"p005",
		"p006",
		"p007",
		"p008"
	];
	try {
		let r = n.map(() => "?").join(",");
		await t.prepare("DELETE FROM construction_stages WHERE application_id NOT IN ('app001','app002')").run(), await t.prepare("UPDATE construction_stages SET invoice_doc_id=NULL WHERE invoice_doc_id IS NOT NULL").run(), await t.prepare("DELETE FROM documents WHERE entity_id NOT IN ('app001','app002','proj001','proj002','proj003','proj004')").run(), await t.prepare("DELETE FROM applications WHERE id NOT IN ('app001','app002')").run(), await t.prepare(`DELETE FROM rules WHERE product_id IS NOT NULL AND product_id NOT IN (${r})`).bind(...n).run(), await t.prepare(`DELETE FROM audit_logs WHERE entity_type='product' AND entity_id NOT IN (${r})`).bind(...n).run();
		try {
			await t.prepare(`DELETE FROM ai_threads WHERE product_id IS NOT NULL AND product_id NOT IN (${r})`).bind(...n).run();
		} catch {}
		await t.prepare(`DELETE FROM products WHERE id NOT IN (${r})`).bind(...n).run();
		for (let [e, n] of [
			["UPDATE products SET\n          name='Standard Home Loan',\n          description='Flagship home financing for Omani nationals and residents. Fixed and variable rate options, top-up facility, and bundled insurance. CBO-compliant with full credit assessment.',\n          status='active', base_rate=5.5, max_ltv=90, max_dbr=60, green_dbr=60,\n          min_term=5, max_term=25, min_amount=10000, max_amount=500000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=90, allow_byop=1, allow_partner_inventory=1,\n          required_docs='[\"civil_id\",\"salary_certificate\",\"utility_bill\",\"property_deed\",\"independent_valuation_report\",\"bank_statements_3m\",\"employer_letter\"]',\n          esg_required_docs='[]',\n          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[\"Fixed and variable rate options\",\"Flexible 5–25 year terms\",\"Top-up facility available\",\"Insurance bundled\"]',\n          updated_at=datetime('now')\n        WHERE id='p001'", []],
			["UPDATE products SET\n          name='Auto Finance – Personal',\n          description='Financing for personal vehicles including sedans, SUVs, and electric vehicles. Competitive flat rate, quick 48-hour approval, covers new and used vehicles up to 5 years old.',\n          status='active', base_rate=4.9, max_ltv=85, max_dbr=55, green_dbr=55,\n          min_term=1, max_term=7, min_amount=3000, max_amount=80000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,\n          required_docs='[\"civil_id\",\"salary_certificate\",\"vehicle_proforma_invoice\",\"driving_license\",\"insurance_quotation\",\"bank_statements_3m\"]',\n          esg_required_docs='[]',\n          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[\"Covers new & used vehicles\",\"48-hour credit decision\",\"EV purchase supported\",\"Comprehensive insurance required\"]',\n          updated_at=datetime('now')\n        WHERE id='p002'", []],
			["UPDATE products SET\n          name='Personal Loan',\n          description='Unsecured personal financing for salaried employees of approved employers. No collateral required. Flat competitive rate for medical, travel, home renovation and other personal needs.',\n          status='active', base_rate=7.5, max_ltv=0, max_dbr=45, green_dbr=45,\n          min_term=1, max_term=5, min_amount=1000, max_amount=30000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,\n          required_docs='[\"civil_id\",\"salary_certificate\",\"employer_letter\",\"bank_statements_3m\",\"approved_employer_confirmation\"]',\n          esg_required_docs='[]',\n          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[\"No collateral required\",\"Approved employer list\",\"Competitive fixed rate\",\"Loan protector insurance available\"]',\n          updated_at=datetime('now')\n        WHERE id='p003'", []],
			["UPDATE products SET\n          name='SME Working Capital',\n          description='Short-term working capital facility for small and medium enterprises registered in Oman. Revolving or term structure. Supports payroll, inventory procurement, and operational growth.',\n          status='active', base_rate=6.5, max_ltv=70, max_dbr=65, green_dbr=65,\n          min_term=1, max_term=3, min_amount=5000, max_amount=200000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=85, allow_byop=0, allow_partner_inventory=0,\n          required_docs='[\"commercial_registration_certificate\",\"memorandum_of_association\",\"audited_financials_2yr\",\"bank_statements_6m\",\"cr_extract\",\"tax_clearance_certificate\",\"business_profile\"]',\n          esg_required_docs='[]',\n          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[\"For Oman-registered SMEs\",\"Revolving or term facility\",\"Supports payroll & growth\",\"MOCI-verified CR required\"]',\n          updated_at=datetime('now')\n        WHERE id='p004'", []],
			["UPDATE products SET\n          name='Home Equity Line',\n          description='Revolving credit facility secured against existing owned property. Access equity without selling. Ideal for large purchases, education, or business funding. Second charge behind primary mortgage.',\n          status='active', base_rate=6.0, max_ltv=75, max_dbr=55, green_dbr=55,\n          min_term=5, max_term=15, min_amount=20000, max_amount=300000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,\n          required_docs='[\"civil_id\",\"property_title_deed\",\"independent_valuation_report\",\"salary_certificate\",\"bank_statements_3m\",\"existing_mortgage_statement\",\"noc_from_primary_lender\"]',\n          esg_required_docs='[]',\n          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[\"Use your property equity\",\"Revolving credit line\",\"Up to OMR 300,000\",\"No early settlement penalty\"]',\n          updated_at=datetime('now')\n        WHERE id='p005'", []],
			["UPDATE products SET\n          name='Commercial Property Finance',\n          description='Financing for commercial properties including offices, retail units, and warehouses. Available to Omani-registered companies and sole proprietors. Full corporate credit assessment applies.',\n          status='active', base_rate=6.8, max_ltv=70, max_dbr=65, green_dbr=65,\n          min_term=5, max_term=20, min_amount=50000, max_amount=2000000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=85, allow_byop=0, allow_partner_inventory=0,\n          required_docs='[\"commercial_registration_certificate\",\"memorandum_of_association\",\"audited_financials_3yr\",\"bank_statements_12m\",\"property_title_deed\",\"independent_valuation_report\",\"lease_agreements\",\"board_resolution\"]',\n          esg_required_docs='[]',\n          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[\"For offices, retail & warehouses\",\"Up to OMR 2,000,000\",\"Flexible repayment structures\",\"Lease income considered\"]',\n          updated_at=datetime('now')\n        WHERE id='p006'", []],
			["UPDATE products SET\n          name='Expat Home Finance',\n          description='Home financing for expatriate professionals working in Oman. Stricter LTV (max 75%) per CBO regulations. Employer NOC required. Available for IZ-approved freehold zones.',\n          status='active', base_rate=6.0, max_ltv=75, max_dbr=55, green_dbr=55,\n          min_term=5, max_term=20, min_amount=15000, max_amount=400000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,\n          required_docs='[\"civil_id\",\"passport_copy\",\"valid_work_permit_residence_card\",\"salary_certificate\",\"noc_from_employer\",\"property_deed_freehold_zone\",\"independent_valuation_report\",\"bank_statements_6m\"]',\n          esg_required_docs='[]',\n          portal_visible=1, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[\"Expatriate professionals\",\"LTV up to 75%\",\"Freehold zone properties\",\"Employer NOC required\"]',\n          updated_at=datetime('now')\n        WHERE id='p007'", []],
			["UPDATE products SET\n          name='Education Finance',\n          description='Financing for higher education expenses including tuition, accommodation, and study materials at approved universities in Oman and abroad. Deferred repayment option available.',\n          status='archived', base_rate=8.0, max_ltv=0, max_dbr=45, green_dbr=45,\n          min_term=1, max_term=8, min_amount=500, max_amount=20000,\n          gsas_min_score=0, gsas_premium_score=0, green_discount_premium=0.0, green_discount_standard=0.0,\n          ai_confidence_threshold=90, allow_byop=0, allow_partner_inventory=0,\n          required_docs='[\"civil_id\",\"university_offer_letter_or_enrollment\",\"salary_certificate\",\"fee_schedule_from_institution\",\"bank_statements_3m\"]',\n          esg_required_docs='[]',\n          portal_visible=0, portal_hero_title=NULL, portal_hero_subtitle=NULL, portal_card_badge=NULL,\n          portal_highlights='[]',\n          updated_at=datetime('now')\n        WHERE id='p008'", []]
		]) await t.prepare(e).bind(...n).run();
		await t.prepare("DELETE FROM rules WHERE source='ai_generated' OR product_id IS NOT NULL").run(), await t.prepare("DELETE FROM rules WHERE id NOT IN ('r001','r002','r003','r004','r005','r006','r007','r008','r009','r010','r011','r012','r013','r014')").run();
		try {
			await t.prepare("DELETE FROM ai_threads").run();
		} catch {}
		await t.prepare("UPDATE applications SET unit_id=NULL WHERE id IN ('app001','app002')").run(), await t.prepare("DELETE FROM units").run(), await t.prepare("DELETE FROM projects WHERE id NOT IN ('proj001','proj002','proj003','proj004')").run(), await t.prepare("DELETE FROM documents WHERE entity_type='project' AND entity_id NOT IN ('proj001','proj002','proj003','proj004')").run(), await t.prepare("INSERT OR REPLACE INTO projects VALUES\n      ('proj001','d001','Al Mouj Residences','AMR-2024','Al Mouj, Muscat','Muscat','apartment',\n       36,12,8,16,78,'Gold','B','EIA/2024/201',\n       '{\"type\":\"FeatureCollection\",\"features\":[]}',\n       'active',1,0,'2024-06-15','2025-11-30',\n       1,'/static/img/proj001_hero.jpg',\n       'Waterfront living with premium amenities in the heart of Muscat',\n       95000,185000,NULL,\n       '[\"Swimming Pool\",\"Gym\",\"24/7 Security\",\"Covered Parking\",\"Children''s Play Area\"]')").run(), await t.prepare("INSERT OR REPLACE INTO projects VALUES\n      ('proj002','d001','Seeb Heights Villas','SHV-2025','Airport Heights, Seeb','Muscat','villa',\n       18,18,0,0,82,'Gold','A',NULL,\n       '{\"type\":\"FeatureCollection\",\"features\":[]}',\n       'active',1,0,'2025-01-10','2025-12-01',\n       1,'/static/img/proj002_hero.jpg',\n       'Spacious villas with panoramic views near Muscat International Airport',\n       145000,220000,NULL,\n       '[\"Private Garden\",\"Rooftop Terrace\",\"Central A/C\",\"Smart Home\",\"Visitor Parking\"]')").run(), await t.prepare("INSERT OR REPLACE INTO projects VALUES\n      ('proj003','d001','Mabella View Apartments','MVA-2023','Mabella, Muscat','Muscat','apartment',\n       60,0,0,60,NULL,NULL,NULL,NULL,\n       '{\"type\":\"FeatureCollection\",\"features\":[]}',\n       'archived',0,0,'2023-05-01','2025-06-30',\n       0,'/static/img/proj003_hero.jpg',\n       NULL,NULL,NULL,NULL,'[]')").run(), await t.prepare("INSERT OR REPLACE INTO projects VALUES\n      ('proj004','d001','EcoVillage Muscat','EVM-2026','Seeb, Muscat Governorate','Muscat','villa',\n       24,0,0,0,NULL,NULL,NULL,NULL,\n       '{\"type\":\"FeatureCollection\",\"features\":[]}',\n       'draft',0,0,'2026-08-31','2026-08-31',\n       0,'/static/img/proj004_hero.jpg',\n       NULL,NULL,NULL,NULL,'[]')").run();
		for (let e of [
			[
				"unit-a001",
				"proj001",
				"A-101",
				"apartment",
				95,
				2,
				2,
				95e3,
				23.5955,
				58.581,
				"available"
			],
			[
				"unit-a002",
				"proj001",
				"A-102",
				"apartment",
				98,
				2,
				2,
				98e3,
				23.5958,
				58.5815,
				"available"
			],
			[
				"unit-a003",
				"proj001",
				"A-103",
				"apartment",
				102,
				2,
				2,
				102e3,
				23.5961,
				58.582,
				"available"
			],
			[
				"unit-a004",
				"proj001",
				"B-201",
				"apartment",
				118,
				3,
				2,
				12e4,
				23.5964,
				58.5825,
				"available"
			],
			[
				"unit-a005",
				"proj001",
				"B-202",
				"apartment",
				120,
				3,
				2,
				125e3,
				23.5967,
				58.583,
				"available"
			],
			[
				"unit-a006",
				"proj001",
				"B-203",
				"apartment",
				122,
				3,
				2,
				128e3,
				23.597,
				58.5835,
				"available"
			],
			[
				"unit-a007",
				"proj001",
				"C-301",
				"apartment",
				145,
				3,
				3,
				148e3,
				23.5973,
				58.584,
				"available"
			],
			[
				"unit-a008",
				"proj001",
				"C-302",
				"apartment",
				148,
				3,
				3,
				152e3,
				23.5976,
				58.5845,
				"available"
			],
			[
				"unit-a009",
				"proj001",
				"D-401",
				"apartment",
				165,
				4,
				3,
				162e3,
				23.5979,
				58.585,
				"available"
			],
			[
				"unit-a010",
				"proj001",
				"D-402",
				"apartment",
				168,
				4,
				3,
				168e3,
				23.5982,
				58.5855,
				"available"
			],
			[
				"unit-a011",
				"proj001",
				"E-501",
				"apartment",
				180,
				4,
				3,
				175e3,
				23.5985,
				58.586,
				"available"
			],
			[
				"unit-a012",
				"proj001",
				"E-502",
				"apartment",
				182,
				4,
				3,
				18e4,
				23.5988,
				58.5865,
				"available"
			],
			[
				"unit-a013",
				"proj001",
				"A-104",
				"apartment",
				95,
				2,
				2,
				97e3,
				23.5958,
				58.5808,
				"reserved"
			],
			[
				"unit-a014",
				"proj001",
				"A-105",
				"apartment",
				98,
				2,
				2,
				1e5,
				23.5961,
				58.5812,
				"reserved"
			],
			[
				"unit-a015",
				"proj001",
				"B-204",
				"apartment",
				118,
				3,
				2,
				122e3,
				23.5964,
				58.5818,
				"reserved"
			],
			[
				"unit-a016",
				"proj001",
				"B-205",
				"apartment",
				120,
				3,
				2,
				126e3,
				23.5967,
				58.5822,
				"reserved"
			],
			[
				"unit-a017",
				"proj001",
				"C-303",
				"apartment",
				145,
				3,
				3,
				15e4,
				23.597,
				58.5828,
				"reserved"
			],
			[
				"unit-a018",
				"proj001",
				"C-304",
				"apartment",
				148,
				3,
				3,
				155e3,
				23.5973,
				58.5832,
				"reserved"
			],
			[
				"unit-a019",
				"proj001",
				"D-403",
				"apartment",
				165,
				4,
				3,
				165e3,
				23.5976,
				58.5838,
				"reserved"
			],
			[
				"unit-a020",
				"proj001",
				"D-404",
				"apartment",
				168,
				4,
				3,
				17e4,
				23.5979,
				58.5842,
				"reserved"
			],
			[
				"unit-a021",
				"proj001",
				"A-106",
				"apartment",
				95,
				2,
				2,
				94e3,
				23.5955,
				58.5805,
				"sold"
			],
			[
				"unit-a022",
				"proj001",
				"A-107",
				"apartment",
				98,
				2,
				2,
				97e3,
				23.5957,
				58.5802,
				"sold"
			],
			[
				"unit-a023",
				"proj001",
				"A-108",
				"apartment",
				100,
				2,
				2,
				99e3,
				23.5959,
				58.5799,
				"sold"
			],
			[
				"unit-a024",
				"proj001",
				"B-206",
				"apartment",
				118,
				3,
				2,
				12e4,
				23.5962,
				58.5796,
				"sold"
			],
			[
				"unit-a025",
				"proj001",
				"B-207",
				"apartment",
				120,
				3,
				2,
				122e3,
				23.5964,
				58.5793,
				"sold"
			],
			[
				"unit-a026",
				"proj001",
				"B-208",
				"apartment",
				122,
				3,
				2,
				124e3,
				23.5966,
				58.579,
				"sold"
			],
			[
				"unit-a027",
				"proj001",
				"C-305",
				"apartment",
				145,
				3,
				3,
				146e3,
				23.5968,
				58.5787,
				"sold"
			],
			[
				"unit-a028",
				"proj001",
				"C-306",
				"apartment",
				148,
				3,
				3,
				15e4,
				23.597,
				58.5784,
				"sold"
			],
			[
				"unit-a029",
				"proj001",
				"C-307",
				"apartment",
				150,
				3,
				3,
				152e3,
				23.5972,
				58.5781,
				"sold"
			],
			[
				"unit-a030",
				"proj001",
				"D-405",
				"apartment",
				165,
				4,
				3,
				162e3,
				23.5974,
				58.5778,
				"sold"
			],
			[
				"unit-a031",
				"proj001",
				"D-406",
				"apartment",
				168,
				4,
				3,
				165e3,
				23.5976,
				58.5775,
				"sold"
			],
			[
				"unit-a032",
				"proj001",
				"E-503",
				"apartment",
				180,
				4,
				3,
				172e3,
				23.5978,
				58.5772,
				"sold"
			],
			[
				"unit-a033",
				"proj001",
				"E-504",
				"apartment",
				182,
				4,
				3,
				176e3,
				23.598,
				58.5769,
				"sold"
			],
			[
				"unit-a034",
				"proj001",
				"F-601",
				"apartment",
				185,
				4,
				3,
				182e3,
				23.5982,
				58.5766,
				"sold"
			],
			[
				"unit-a035",
				"proj001",
				"F-602",
				"apartment",
				188,
				4,
				3,
				184e3,
				23.5984,
				58.5763,
				"sold"
			],
			[
				"unit-a036",
				"proj001",
				"F-603",
				"apartment",
				190,
				4,
				3,
				185e3,
				23.5986,
				58.576,
				"sold"
			]
		]) await t.prepare("INSERT OR IGNORE INTO units\n        (id,project_id,unit_number,type,area_sqm,bedrooms,bathrooms,price,lat,lng,status,features,gsas_score,created_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))").bind(e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], e[10], "[\"Swimming Pool\",\"Gym\",\"24/7 Security\"]", 78).run();
		for (let e of [
			[
				"unit-b001",
				"proj002",
				"V-001",
				"villa",
				280,
				4,
				3,
				145e3,
				23.5985,
				58.475,
				"available"
			],
			[
				"unit-b002",
				"proj002",
				"V-002",
				"villa",
				285,
				4,
				3,
				148e3,
				23.599,
				58.4755,
				"available"
			],
			[
				"unit-b003",
				"proj002",
				"V-003",
				"villa",
				290,
				4,
				3,
				152e3,
				23.5995,
				58.476,
				"available"
			],
			[
				"unit-b004",
				"proj002",
				"V-004",
				"villa",
				295,
				4,
				3,
				155e3,
				23.6,
				58.4765,
				"available"
			],
			[
				"unit-b005",
				"proj002",
				"V-005",
				"villa",
				300,
				5,
				4,
				162e3,
				23.6005,
				58.477,
				"available"
			],
			[
				"unit-b006",
				"proj002",
				"V-006",
				"villa",
				305,
				5,
				4,
				165e3,
				23.601,
				58.4775,
				"available"
			],
			[
				"unit-b007",
				"proj002",
				"V-007",
				"villa",
				310,
				5,
				4,
				17e4,
				23.6015,
				58.478,
				"available"
			],
			[
				"unit-b008",
				"proj002",
				"V-008",
				"villa",
				315,
				5,
				4,
				175e3,
				23.602,
				58.4785,
				"available"
			],
			[
				"unit-b009",
				"proj002",
				"V-009",
				"villa",
				280,
				4,
				3,
				148e3,
				23.5985,
				58.4758,
				"available"
			],
			[
				"unit-b010",
				"proj002",
				"V-010",
				"villa",
				285,
				4,
				3,
				15e4,
				23.599,
				58.4763,
				"available"
			],
			[
				"unit-b011",
				"proj002",
				"V-011",
				"villa",
				290,
				4,
				3,
				155e3,
				23.5995,
				58.4768,
				"available"
			],
			[
				"unit-b012",
				"proj002",
				"V-012",
				"villa",
				295,
				4,
				3,
				158e3,
				23.6,
				58.4773,
				"available"
			],
			[
				"unit-b013",
				"proj002",
				"V-013",
				"villa",
				300,
				5,
				4,
				165e3,
				23.6005,
				58.4778,
				"available"
			],
			[
				"unit-b014",
				"proj002",
				"V-014",
				"villa",
				305,
				5,
				4,
				168e3,
				23.601,
				58.4783,
				"available"
			],
			[
				"unit-b015",
				"proj002",
				"V-015",
				"villa",
				310,
				5,
				4,
				172e3,
				23.6015,
				58.4788,
				"available"
			],
			[
				"unit-b016",
				"proj002",
				"V-016",
				"villa",
				315,
				5,
				4,
				178e3,
				23.602,
				58.4793,
				"available"
			],
			[
				"unit-b017",
				"proj002",
				"V-017",
				"villa",
				320,
				5,
				4,
				185e3,
				23.6025,
				58.4798,
				"available"
			],
			[
				"unit-b018",
				"proj002",
				"V-018",
				"villa",
				325,
				5,
				4,
				22e4,
				23.603,
				58.4803,
				"available"
			]
		]) await t.prepare("INSERT OR IGNORE INTO units\n        (id,project_id,unit_number,type,area_sqm,bedrooms,bathrooms,price,lat,lng,status,features,gsas_score,created_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))").bind(e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], e[10], "[\"Private Garden\",\"Rooftop Terrace\",\"Smart Home\"]", 82).run();
		for (let e of [
			[
				"unit-c001",
				"proj003",
				"M-101",
				"apartment",
				75,
				2,
				1,
				62e3,
				23.583,
				58.554,
				"sold"
			],
			[
				"unit-c002",
				"proj003",
				"M-102",
				"apartment",
				78,
				2,
				1,
				64e3,
				23.5835,
				58.5545,
				"sold"
			],
			[
				"unit-c003",
				"proj003",
				"M-201",
				"apartment",
				90,
				3,
				2,
				72e3,
				23.584,
				58.555,
				"sold"
			],
			[
				"unit-c004",
				"proj003",
				"M-202",
				"apartment",
				92,
				3,
				2,
				74e3,
				23.5845,
				58.5555,
				"sold"
			],
			[
				"unit-c005",
				"proj003",
				"M-301",
				"apartment",
				105,
				3,
				2,
				82e3,
				23.585,
				58.556,
				"sold"
			],
			[
				"unit-c006",
				"proj003",
				"M-302",
				"apartment",
				108,
				3,
				2,
				85e3,
				23.5855,
				58.5565,
				"sold"
			]
		]) await t.prepare("INSERT OR IGNORE INTO units\n        (id,project_id,unit_number,type,area_sqm,bedrooms,bathrooms,price,lat,lng,status,features,gsas_score,created_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))").bind(e[0], e[1], e[2], e[3], e[4], e[5], e[6], e[7], e[8], e[9], e[10], "[]", null).run();
		return await t.prepare("INSERT OR REPLACE INTO applications VALUES\n      ('app001','HL-240892','p001','c002','Mariam Al-Siyabi',NULL,'proj001',\n       250000,20,'Al Mouj Residences, Unit A12, Muscat','partner',142,NULL,NULL,\n       5.5,5.5,1608.82,1608.82,0,46,78,9.0,1,780,'approved','verified',\n       'u002','2024-09-15','u003','2024-09-16',250000,0,NULL,NULL,\n       '2024-09-14','2024-09-16')").run(), await t.prepare("INSERT OR REPLACE INTO applications VALUES\n      ('app002','HL-241156','p001','c003','Hassan Al-Amri',NULL,NULL,\n       120000,15,'Plot 45, Al Ghubra North, Muscat','byop',200,NULL,NULL,\n       5.5,5.5,980.12,980.12,0,36,72,9.0,1,710,'credit_review','pending',\n       NULL,NULL,NULL,NULL,120000,0,NULL,NULL,\n       '2024-12-01','2024-12-03')").run(), await t.prepare("DELETE FROM audit_logs WHERE id NOT IN ('al001','al002','al003','al004')").run(), await t.prepare("INSERT OR REPLACE INTO audit_logs VALUES\n      ('al001','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p001','{\"status\":\"active\",\"product_name\":\"Standard Home Loan\"}','manual',NULL,NULL,'10.10.50.15','2024-01-10 09:00:00')").run(), await t.prepare("INSERT OR REPLACE INTO audit_logs VALUES\n      ('al002','u001','Fatima Al-Rashdi','product_manager','PRODUCT_PUBLISHED','product','p002','{\"status\":\"active\",\"product_name\":\"Auto Finance – Personal\"}','manual',NULL,NULL,'10.10.50.15','2023-06-01 10:00:00')").run(), await t.prepare("INSERT OR REPLACE INTO audit_logs VALUES\n      ('al003','u002','Aisha Al-Balushi','compliance_officer','APPLICATION_APPROVED','application','app001','{\"reference\":\"HL-240892\",\"customer\":\"Mariam Al-Siyabi\",\"amount\":250000}','manual',NULL,'CBO Circular 2024-01','10.10.50.22','2024-09-15 14:30:00')").run(), await t.prepare("INSERT OR REPLACE INTO audit_logs VALUES\n      ('al004','u003','Omar Al-Mantheri','risk_officer','CREDIT_REVIEW_APPROVED','application','app001','{\"reference\":\"HL-240892\",\"dbr\":46,\"ltv\":78,\"stress_test\":\"passed\"}','manual',NULL,'CBO Circular 2024-01','10.10.50.33','2024-09-16 11:00:00')").run(), await t.prepare("PRAGMA foreign_keys = ON").run(), e.json({
			success: !0,
			message: "System fully reset to template state. All demo-created products, applications, threads, and live data removed. Ready for a fresh run."
		});
	} catch (t) {
		try {
			await e.env.DB.prepare("PRAGMA foreign_keys = ON").run();
		} catch {}
		return e.json({
			success: !1,
			error: t.message
		}, 500);
	}
});
//#endregion
//#region src/api/portal.ts
var q = new P();
q.get("/products/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT p.*, \n     (SELECT COUNT(*) FROM applications a WHERE a.product_id = p.id) as total_applications\n     FROM products p WHERE p.id = ? AND p.portal_visible = 1").bind(t).first();
	if (!n) return e.json({ error: "Not found" }, 404);
	let { results: r } = await e.env.DB.prepare("SELECT name, category, metric, operator, threshold_value, threshold_condition, severity, description, regulatory_reference\n     FROM rules WHERE (product_id = ? OR product_id IS NULL) AND is_active = 1\n     ORDER BY category, severity DESC").bind(t).all();
	return e.json({
		product: n,
		rules: r
	});
}), q.get("/calculator", async (e) => {
	let t = e.req.query("product_id"), n = parseFloat(e.req.query("amount") || "0"), r = parseInt(e.req.query("term") || "25"), i = parseInt(e.req.query("gsas_score") || "0"), a = parseFloat(e.req.query("salary") || "0");
	if (!t || !n || !r) return e.json({ error: "product_id, amount, and term are required" }, 400);
	let o = await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();
	if (!o) return e.json({ error: "Product not found" }, 404);
	let s = 0;
	i >= (o.gsas_premium_score || 85) ? s = o.green_discount_premium || 0 : i >= (o.gsas_min_score || 70) && (s = o.green_discount_standard || 0);
	let c = parseFloat((o.base_rate - s).toFixed(3)), l = o.base_rate, u = c / 100 / 12, d = r * 12, f = u > 0 ? n * (u * (1 + u) ** +d) / ((1 + u) ** +d - 1) : n / d, p = l / 100 / 12, m = p > 0 ? n * (p * (1 + p) ** +d) / ((1 + p) ** +d - 1) : n / d, h = Math.round((m - f) * d), g = a > 0 ? parseFloat((f / a * 100).toFixed(1)) : null;
	return e.json({
		product_name: o.name,
		loan_amount: n,
		term_years: r,
		base_rate: l,
		rate_discount: s,
		applied_rate: c,
		monthly_payment: Math.round(f * 100) / 100,
		standard_monthly_payment: Math.round(m * 100) / 100,
		lifetime_saving: Math.max(0, h),
		dbr: g,
		gsas_score: i || null,
		green_eligible: i >= (o.gsas_min_score || 70),
		premium_tier: i >= (o.gsas_premium_score || 85)
	});
}), q.get("/projects", async (e) => {
	let { results: t } = await e.env.DB.prepare("SELECT p.id, p.name, p.code, p.location, p.governorate, p.type,\n     p.total_units, p.available_units, p.reserved_units, p.sold_units,\n     p.gsas_score, p.gsas_rating, p.epc_rating, p.status, p.green_eligible,\n     p.premium_tier, p.geo_json,\n     p.listing_visible, p.marketing_tagline, p.price_from, p.price_to,\n     p.completion_date, p.amenities, p.created_at,\n     d.company_name as developer_name\n     FROM projects p\n     LEFT JOIN developers d ON p.developer_id = d.id\n     WHERE p.listing_visible = 1 AND p.status = 'active'\n     ORDER BY p.premium_tier DESC, p.created_at DESC").all();
	return e.json({
		projects: t,
		total: t.length
	});
}), q.get("/projects/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT p.*, d.company_name as developer_name, d.contact_name\n     FROM projects p LEFT JOIN developers d ON p.developer_id = d.id\n     WHERE p.id = ? AND p.listing_visible = 1").bind(t).first();
	if (!n) return e.json({ error: "Not found" }, 404);
	let { results: r } = await e.env.DB.prepare("SELECT * FROM units WHERE project_id = ? ORDER BY unit_number").bind(t).all();
	return e.json({
		project: n,
		units: r
	});
}), q.post("/applications", async (e) => {
	let { product_id: t, customer_name: n, unit_id: r, project_id: i, loan_amount: a, loan_term: o, property_address: s, property_source: c, gsas_score: l, epc_rating: u, salary: d, civil_id: f } = await e.req.json(), p = await e.env.DB.prepare("SELECT * FROM products WHERE id = ? AND status = ?").bind(t, "active").first();
	if (!p) return e.json({ error: "Product not found or not active" }, 404);
	let m = 0;
	l >= (p.gsas_premium_score || 85) ? m = p.green_discount_premium || 0 : l >= (p.gsas_min_score || 70) && (m = p.green_discount_standard || 0);
	let h = parseFloat((p.base_rate - m).toFixed(3)), g = o * 12, _ = h / 100 / 12, v = _ > 0 ? a * (_ * (1 + _) ** +g) / ((1 + _) ** +g - 1) : a / g, y = p.base_rate / 100 / 12, b = y > 0 ? a * (y * (1 + y) ** +g) / ((1 + y) ** +g - 1) : a / g, x = Math.max(0, Math.round((b - v) * g)), S = d ? parseFloat((v / d * 100).toFixed(1)) : null, C = R("app"), w = z(), T = "GHL-" + Date.now().toString().slice(-6), E = null;
	if (f) {
		let t = await e.env.DB.prepare("SELECT id FROM customers WHERE civil_id = ?").bind(f).first();
		t && (E = t.id);
	}
	if (await e.env.DB.prepare("\n    INSERT INTO applications (id,reference,product_id,customer_id,customer_name,unit_id,project_id,\n    loan_amount,loan_term,property_address,property_source,gsas_score,epc_rating,\n    applied_rate,standard_rate,monthly_payment,standard_monthly_payment,lifetime_saving,dbr,\n    escrow_amount,status,esg_verification_status,created_at,updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(C, T, t, E || null, n, r || null, i || null, a, o, s || null, c || "partner", l || null, u || null, h, p.base_rate, Math.round(v * 100) / 100, Math.round(b * 100) / 100, x, S, a, "submitted", l ? "pending" : "not_applicable", w, w).run(), p.esg_required_docs && JSON.parse(p.esg_required_docs || "[]").length > 0) for (let t of [
		{
			num: 1,
			name: "Foundation & Groundwork",
			desc: "Complete foundation, groundwork, and underground utilities",
			pct: 25,
			mat: "Green Concrete – C30 Grade",
			status: "active"
		},
		{
			num: 2,
			name: "Roof & Envelope",
			desc: "Roof structure, external walls, and thermal envelope",
			pct: 30,
			mat: "Thermal Insulation (R-30+)",
			status: "locked"
		},
		{
			num: 3,
			name: "MEP & Solar Installation",
			desc: "Mechanical, electrical, plumbing, and solar installation",
			pct: 25,
			mat: "Solar Panels (min 5kWp)",
			status: "locked"
		},
		{
			num: 4,
			name: "Finishing & Handover",
			desc: "Interior finishing, energy-efficient appliances, and final handover",
			pct: 20,
			mat: "Energy-Efficient Appliances",
			status: "locked"
		}
	]) {
		let n = Math.round(a * t.pct / 100);
		await e.env.DB.prepare("\n        INSERT INTO construction_stages (id,application_id,stage_number,stage_name,description,tranche_amount,tranche_percentage,required_material,status,created_at)\n        VALUES (?,?,?,?,?,?,?,?,?,?)\n      ").bind(R("st"), C, t.num, t.name, t.desc, n, t.pct, t.mat, t.status, w).run();
	}
	return await B(e.env.DB, {
		userId: E || "portal",
		userName: n,
		userRole: "customer",
		action: "APPLICATION_SUBMITTED",
		entityType: "application",
		entityId: C,
		details: {
			reference: T,
			product_id: t,
			loan_amount: a,
			applied_rate: h
		}
	}), e.json({
		success: !0,
		application_id: C,
		reference: T,
		applied_rate: h,
		monthly_payment: Math.round(v * 100) / 100,
		lifetime_saving: x,
		status: "submitted"
	});
}), q.get("/applications/:ref/status", async (e) => {
	let t = e.req.param("ref"), n = await e.env.DB.prepare("SELECT a.*, p.name as product_name, p.portal_hero_title\n     FROM applications a LEFT JOIN products p ON a.product_id = p.id\n     WHERE a.reference = ?").bind(t).first();
	if (!n) return e.json({ error: "Application not found" }, 404);
	let { results: r } = await e.env.DB.prepare("SELECT * FROM construction_stages WHERE application_id = ? ORDER BY stage_number").bind(n.id).all(), { results: i } = await e.env.DB.prepare("SELECT doc_type, filename, validation_status, ai_confidence, created_at FROM documents WHERE entity_type = ? AND entity_id = ?").bind("application", n.id).all(), a = {
		submitted: "Application Received",
		credit_scoring: "Credit Assessment",
		esg_review: "ESG Verification",
		credit_review: "Final Credit Review",
		approved: "Approved",
		disbursed: "Funds Disbursed",
		completed: "Completed",
		rejected: "Rejected"
	}, o = [
		{
			key: "submitted",
			label: "Application Submitted",
			done: !0
		},
		{
			key: "credit_scoring",
			label: "Credit Scoring (MALA'A)",
			done: [
				"credit_scoring",
				"esg_review",
				"credit_review",
				"approved",
				"disbursed",
				"completed"
			].includes(n.status)
		},
		{
			key: "esg_review",
			label: "ESG Document Verification",
			done: [
				"esg_review",
				"credit_review",
				"approved",
				"disbursed",
				"completed"
			].includes(n.status)
		},
		{
			key: "credit_review",
			label: "Maker-Checker Approval",
			done: [
				"credit_review",
				"approved",
				"disbursed",
				"completed"
			].includes(n.status)
		},
		{
			key: "approved",
			label: "Loan Approved",
			done: [
				"approved",
				"disbursed",
				"completed"
			].includes(n.status)
		},
		{
			key: "disbursed",
			label: "Funds Disbursed",
			done: ["disbursed", "completed"].includes(n.status)
		}
	];
	return e.json({
		reference: n.reference,
		status: n.status,
		status_label: a[n.status] || n.status,
		product_name: n.product_name,
		loan_amount: n.loan_amount,
		applied_rate: n.applied_rate,
		monthly_payment: n.monthly_payment,
		lifetime_saving: n.lifetime_saving,
		esg_verification_status: n.esg_verification_status,
		compliance_approved_at: n.compliance_approved_at,
		risk_approved_at: n.risk_approved_at,
		timeline: o,
		construction_stages: r,
		documents: i,
		created_at: n.created_at
	});
}), q.get("/developer/products", async (e) => {
	let { results: t } = await e.env.DB.prepare("SELECT id, name, code, description, category, base_rate, max_ltv, max_dbr, green_dbr,\n     min_term, max_term, min_amount, max_amount,\n     gsas_min_score, gsas_premium_score, green_discount_premium, green_discount_standard,\n     allow_partner_inventory, required_docs, esg_required_docs,\n     approved_materials, approved_vendors, ai_confidence_threshold,\n     portal_hero_title, developer_requirements, published_at\n     FROM products WHERE developer_portal_visible = 1 AND status = 'active'\n     ORDER BY published_at ASC").all(), n = await Promise.all(t.map(async (t) => {
		let { results: n } = await e.env.DB.prepare("SELECT name, category, metric, operator, threshold_value, threshold_condition, severity, description, regulatory_reference\n       FROM rules WHERE (product_id = ? OR (product_id IS NULL AND category IN ('esg','compliance'))) AND is_active = 1\n       ORDER BY category").bind(t.id).all();
		return {
			...t,
			rules: n
		};
	}));
	return e.json({
		products: n,
		total: n.length
	});
}), q.post("/developer/projects", async (e) => {
	let t = await e.req.json(), n = R("proj"), r = t.code || `PROJ-${Date.now().toString(36).toUpperCase()}`, i = z();
	return await e.env.DB.prepare("\n    INSERT INTO projects (id, developer_id, name, code, location, governorate, type,\n    total_units, available_units, geo_json, status, created_at, updated_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, t.developer_id || "d001", t.name, r, t.location, t.governorate || "Muscat", t.type || "villa", t.total_units || 0, t.total_units || 0, JSON.stringify(t.geo_json || {}), "draft", i, i).run(), await B(e.env.DB, {
		userId: t.user_id || "u010",
		userName: "Ahmed Al-Hinai",
		userRole: "developer",
		action: "PROJECT_CREATED",
		entityType: "project",
		entityId: n,
		details: {
			name: t.name,
			location: t.location,
			units: t.total_units
		}
	}), e.json({
		id: n,
		code: r,
		success: !0
	});
}), q.post("/developer/projects/:id/documents", async (e) => {
	let t = e.req.param("id"), { doc_type: n, filename: r, user_id: i = "u010" } = await e.req.json(), a = {
		gsas_cert: {
			extracted_data: {
				certificate_number: "GSAS-2026-078",
				issuer: "GORD",
				issue_date: "2026-02-15",
				expiry_date: "2028-12-31",
				overall_score: 89,
				rating: "Gold",
				property: "EcoVillage Muscat"
			},
			ai_confidence: 96,
			validation_status: "auto_verified",
			validation_notes: "Auto-verified: All fields validated. Score 89 meets minimum threshold (70). Premium tier (≥85): 0.75% discount applies."
		},
		epc_report: {
			extracted_data: {
				rating: "A",
				expiry_date: "2027-05-01",
				energy_consumption: "85 kWh/m²/year",
				assessor: "Green Build Oman"
			},
			ai_confidence: 88,
			validation_status: "manual_review",
			validation_notes: "Manual review required: Slight image skew reduced confidence below 90% threshold. Rating A confirmed; visual verification recommended."
		},
		eia_approval: {
			extracted_data: {
				reference: "EIA/2026/442",
				issuer: "Environment Authority",
				approval_date: "2026-03-10",
				valid_until: "2029-03-10",
				units: 24,
				status: "Approved"
			},
			ai_confidence: 95,
			validation_status: "auto_verified",
			validation_notes: "Auto-verified: EIA clearance confirmed for 24 units. Issuer accredited."
		}
	}[n] || {
		extracted_data: {},
		ai_confidence: 80,
		validation_status: "pending",
		validation_notes: "Awaiting manual review."
	}, o = R("doc"), s = z();
	return await e.env.DB.prepare("\n    INSERT INTO documents (id, entity_type, entity_id, doc_type, filename,\n    extracted_data, ai_confidence, validation_status, validation_notes, created_at)\n    VALUES (?,?,?,?,?,?,?,?,?,?)\n  ").bind(o, "project", t, n, r || `${n}.pdf`, JSON.stringify(a.extracted_data), a.ai_confidence, a.validation_status, a.validation_notes, s).run(), n === "gsas_cert" && a.extracted_data.overall_score && await e.env.DB.prepare("UPDATE projects SET gsas_score = ?, gsas_rating = ?, updated_at = ? WHERE id = ?").bind(a.extracted_data.overall_score, a.extracted_data.rating, s, t).run(), n === "epc_report" && a.extracted_data.rating && await e.env.DB.prepare("UPDATE projects SET epc_rating = ?, updated_at = ? WHERE id = ?").bind(a.extracted_data.rating, s, t).run(), n === "eia_approval" && a.extracted_data.reference && await e.env.DB.prepare("UPDATE projects SET eia_reference = ?, updated_at = ? WHERE id = ?").bind(a.extracted_data.reference, s, t).run(), await B(e.env.DB, {
		userId: i,
		userName: "Ahmed Al-Hinai",
		userRole: "developer",
		action: a.validation_status === "auto_verified" ? "DOCUMENT_AUTO_VERIFIED" : "DOCUMENT_FLAGGED_REVIEW",
		entityType: "document",
		entityId: o,
		details: {
			doc_type: n,
			confidence: a.ai_confidence,
			project_id: t
		},
		source: "ai_generated",
		aiConfidence: a.ai_confidence
	}), e.json({
		doc_id: o,
		success: !0,
		...a
	});
}), q.get("/developer/projects/:id/units", async (e) => {
	let t = e.req.param("id"), { results: n } = await e.env.DB.prepare("SELECT * FROM units WHERE project_id = ? ORDER BY unit_number").bind(t).all();
	return e.json({ units: n });
}), q.post("/developer/projects/:id/units", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z(), i = Array.isArray(n.units) ? n.units : [n], a = 0;
	for (let n of i) {
		let i = R("unit");
		await e.env.DB.prepare("\n      INSERT OR IGNORE INTO units (id, project_id, unit_number, floor_number, type, area_sqm,\n      bedrooms, bathrooms, price, lat, lng, status, features, image_url, gsas_score, created_at)\n      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n    ").bind(i, t, n.unit_number, n.floor_number || 1, n.type || "villa", n.area_sqm || 0, n.bedrooms || 4, n.bathrooms || 3, n.price || 0, n.lat || null, n.lng || null, n.status || "available", typeof n.features == "string" ? n.features : JSON.stringify(n.features || []), n.image_url || null, n.gsas_score || null, r).run(), a++;
	}
	let o = await e.env.DB.prepare("\n    SELECT\n      COUNT(*) as total,\n      SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as avail\n    FROM units WHERE project_id = ?\n  ").bind(t).first();
	return await e.env.DB.prepare("UPDATE projects SET total_units = ?, available_units = ?, updated_at = ? WHERE id = ?").bind(o?.total || a, o?.avail || a, r, t).run(), e.json({
		id: (i.length, void 0),
		success: !0,
		units_created: a
	});
}), q.post("/developer/projects/:id/publish", async (e) => {
	let t = e.req.param("id"), n = await e.req.json().catch(() => ({})), r = z();
	return await e.env.DB.prepare("\n    UPDATE projects SET status = 'active', listing_visible = 1, green_eligible = 1, premium_tier = 1,\n    marketing_tagline = ?, price_from = ?, price_to = ?, amenities = ?,\n    completion_date = ?, updated_at = ? WHERE id = ?\n  ").bind(n.marketing_tagline || "Certified green living — GSAS Gold, EPC A-rated, energy-efficient villas in Seeb", n.price_from || 178e3, n.price_to || 198e3, JSON.stringify(n.amenities || [
		"GSAS Gold Certified",
		"Solar Panels",
		"Smart Home",
		"EV Charging",
		"Private Pool Available"
	]), n.completion_date || "2027-Q4", r, t).run(), await B(e.env.DB, {
		userId: n.user_id || "u010",
		userName: "Ahmed Al-Hinai",
		userRole: "developer",
		action: "PROJECT_PUBLISHED",
		entityType: "project",
		entityId: t,
		details: {
			listing_visible: !0,
			green_eligible: !0
		}
	}), e.json({
		success: !0,
		listing_visible: !0
	});
}), q.patch("/developer/projects/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json().catch(() => ({})), r = z(), i = [
		"hero_image_url",
		"marketing_tagline",
		"price_from",
		"price_to",
		"completion_date",
		"amenities",
		"gsas_score",
		"gsas_rating",
		"epc_rating",
		"eia_reference",
		"green_eligible",
		"premium_tier",
		"listing_visible",
		"name",
		"location",
		"governorate"
	], a = [], o = [];
	for (let e of i) n[e] !== void 0 && (a.push(`${e}=?`), o.push(n[e]));
	return a.length ? (o.push(r, t), await e.env.DB.prepare(`UPDATE projects SET ${a.join(",")}, updated_at=? WHERE id=?`).bind(...o).run(), e.json({ success: !0 })) : e.json({ success: !0 });
}), q.patch("/developer/projects/:pid/units/:uid", async (e) => {
	let t = e.req.param("pid"), n = e.req.param("uid"), r = await e.req.json().catch(() => ({})), i = z(), a = [
		"status",
		"price",
		"unit_number",
		"type",
		"area_sqm",
		"bedrooms",
		"bathrooms",
		"image_url",
		"gsas_score",
		"features",
		"floor_number"
	], o = [], s = [];
	for (let e of a) r[e] !== void 0 && (o.push(`${e}=?`), s.push(r[e]));
	if (!o.length) return e.json({
		success: !0,
		message: "No fields to update"
	});
	if (s.push(n, t), await e.env.DB.prepare(`UPDATE units SET ${o.join(",")} WHERE id=? AND project_id=?`).bind(...s).run(), r.status !== void 0) {
		let n = await e.env.DB.prepare("\n      SELECT\n        COUNT(*) as total,\n        SUM(CASE WHEN status='available' THEN 1 ELSE 0 END) as avail,\n        SUM(CASE WHEN status='reserved' THEN 1 ELSE 0 END) as res,\n        SUM(CASE WHEN status='sold' THEN 1 ELSE 0 END) as sold\n      FROM units WHERE project_id = ?\n    ").bind(t).first();
		await e.env.DB.prepare("UPDATE projects SET total_units=?, available_units=?, reserved_units=?, sold_units=?, updated_at=? WHERE id=?").bind(n?.total || 0, n?.avail || 0, n?.res || 0, n?.sold || 0, i, t).run();
	}
	return e.json({ success: !0 });
}), q.get("/developer/projects", async (e) => {
	let t = e.req.query("developer_id") || "d001", { results: n } = await e.env.DB.prepare("SELECT p.*, d.company_name as developer_name,\n     (SELECT COUNT(*) FROM units u WHERE u.project_id = p.id AND u.status = 'available') as units_available,\n     (SELECT COUNT(*) FROM applications a WHERE a.project_id = p.id) as total_applications\n     FROM projects p LEFT JOIN developers d ON p.developer_id = d.id\n     WHERE p.developer_id = ? ORDER BY p.created_at DESC").bind(t).all();
	return e.json({
		projects: n,
		total: n.length
	});
});
//#endregion
//#region src/api/markets.ts
var J = new P();
J.get("/", async (e) => {
	let { results: t } = await e.env.DB.prepare("SELECT * FROM markets ORDER BY is_default DESC, name ASC").all();
	return e.json({ markets: t });
}), J.get("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT * FROM markets WHERE id = ?").bind(t).first();
	return n ? e.json({ market: n }) : e.json({ error: "Market not found" }, 404);
}), J.get("/default/current", async (e) => {
	let t = await e.env.DB.prepare("SELECT * FROM markets WHERE is_default = 1 AND status = 'active' LIMIT 1").first();
	return t ? e.json({ market: t }) : e.json({ error: "No default market configured" }, 404);
}), J.post("/regulatory-profile", async (e) => {
	let { country: t } = await e.req.json();
	if (!t) return e.json({ error: "country is required" }, 400);
	let n = e.env.OPENAI_API_KEY;
	if (!n) return e.json({ error: "OpenAI API key not configured" }, 500);
	let r = `You are a banking regulatory expert. For the country "${t}", provide a complete regulatory profile for retail banking / mortgage lending.

Return ONLY a valid JSON object with exactly this structure (no markdown, no code blocks):
{
  "country": "full official country name",
  "country_code": "ISO 3166-1 alpha-2 code (2 letters, uppercase)",
  "currency_code": "ISO 4217 code (3 letters, uppercase)",
  "currency_name": "full currency name in English",
  "currency_name_ar": "currency name in Arabic (or null if not applicable)",
  "currency_symbol": "currency symbol (e.g. $, £, ر.ع.)",
  "regulator_name": "short regulator abbreviation (e.g. CBO, CBUAE, CBB, SAMA)",
  "regulator_name_ar": "regulator name in Arabic",
  "regulator_full_name": "full regulator name in English",
  "regulator_full_name_ar": "full regulator name in Arabic",
  "locale": "primary locale code (e.g. en, ar)",
  "rtl_supported": true or false,
  "regulatory_defaults": {
    "default_max_dbr": number (percentage, e.g. 50),
    "default_green_dbr": number (percentage, usually 5% lower than max_dbr),
    "default_max_ltv": number (percentage, e.g. 80),
    "default_max_ltv_expat": number (percentage, usually lower),
    "default_max_term_years": number (e.g. 25),
    "default_min_term_years": number (e.g. 1),
    "default_base_rate": number (approximate current benchmark rate),
    "default_ai_confidence_threshold": 90,
    "gsas_standard_threshold": number or null,
    "gsas_premium_threshold": number or null,
    "green_discount_standard_pct": number or null,
    "green_discount_premium_pct": number or null,
    "stress_test_rate": number (stress test rate, e.g. 9.0),
    "min_malaa_score": number or null,
    "regulatory_framework": "primary regulatory framework name",
    "esg_framework": "ESG/green building framework if applicable, or null",
    "date_format": "DD/MM/YYYY or MM/DD/YYYY",
    "number_format": "1,234.56",
    "max_finance_amount": number (typical maximum mortgage in local currency),
    "min_finance_amount": number (typical minimum in local currency)
  }
}`;
	try {
		let t = (await (await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${n}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [{
					role: "user",
					content: r
				}],
				temperature: .1,
				max_tokens: 800
			})
		})).json()).choices?.[0]?.message?.content || "", i = JSON.parse(t.replace(/```json\n?|\n?```/g, "").trim());
		return e.json({
			profile: i,
			source: "llm"
		});
	} catch (t) {
		return e.json({ error: "Failed to fetch regulatory profile: " + t.message }, 500);
	}
}), J.post("/", async (e) => {
	let t = await e.req.json(), n = R("mkt"), r = z();
	return t.is_default && await e.env.DB.prepare("UPDATE markets SET is_default = 0").run(), await e.env.DB.prepare("\n    INSERT INTO markets (\n      id, name, name_ar, code, country, country_code,\n      currency_code, currency_name, currency_name_ar, currency_symbol,\n      regulator_name, regulator_name_ar, regulator_full_name, regulator_full_name_ar,\n      locale, rtl_supported, regulatory_defaults, status, is_default, created_by, created_at, updated_at\n    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, t.name, t.name_ar || null, t.code?.toUpperCase() || n, t.country, t.country_code?.toUpperCase() || "", t.currency_code?.toUpperCase() || "", t.currency_name || "", t.currency_name_ar || null, t.currency_symbol || "", t.regulator_name || "", t.regulator_name_ar || null, t.regulator_full_name || "", t.regulator_full_name_ar || null, t.locale || "en", +!!t.rtl_supported, JSON.stringify(t.regulatory_defaults || {}), t.status || "active", +!!t.is_default, t.created_by || "u001", r, r).run(), await B(e.env.DB, {
		userId: t.created_by || "u001",
		userName: t.user_name || "System",
		userRole: "admin",
		action: "MARKET_CREATED",
		entityType: "market",
		entityId: n,
		details: {
			name: t.name,
			country: t.country
		}
	}), e.json({
		id: n,
		success: !0
	});
}), J.patch("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z();
	if (!await e.env.DB.prepare("SELECT * FROM markets WHERE id = ?").bind(t).first()) return e.json({ error: "Market not found" }, 404);
	n.is_default && await e.env.DB.prepare("UPDATE markets SET is_default = 0 WHERE id != ?").bind(t).run();
	let i = [], a = [], o = (e, t) => {
		t !== void 0 && (i.push(`${e} = ?`), a.push(t));
	};
	return o("name", n.name), o("name_ar", n.name_ar), o("currency_code", n.currency_code), o("currency_name", n.currency_name), o("currency_name_ar", n.currency_name_ar), o("currency_symbol", n.currency_symbol), o("regulator_name", n.regulator_name), o("regulator_name_ar", n.regulator_name_ar), o("regulator_full_name", n.regulator_full_name), o("regulator_full_name_ar", n.regulator_full_name_ar), o("locale", n.locale), o("status", n.status), n.is_default !== void 0 && (i.push("is_default = ?"), a.push(+!!n.is_default)), n.regulatory_defaults !== void 0 && (i.push("regulatory_defaults = ?"), a.push(JSON.stringify(n.regulatory_defaults))), i.length === 0 ? e.json({
		success: !0,
		message: "No changes"
	}) : (i.push("updated_at = ?"), a.push(r), a.push(t), await e.env.DB.prepare(`UPDATE markets SET ${i.join(", ")} WHERE id = ?`).bind(...a).run(), await B(e.env.DB, {
		userId: n.user_id || "u001",
		userName: n.user_name || "System",
		userRole: "admin",
		action: "MARKET_UPDATED",
		entityType: "market",
		entityId: t,
		details: { updated_fields: i }
	}), e.json({ success: !0 }));
});
//#endregion
//#region src/api/rule-matrices.ts
var Y = new P();
Y.get("/", async (e) => {
	let t = e.req.query("product_id"), n = e.req.query("market_id"), r = "SELECT * FROM rule_matrices WHERE 1=1", i = [];
	t && (r += " AND product_id = ?", i.push(t)), n && (r += " AND market_id = ?", i.push(n)), r += " ORDER BY name ASC";
	let { results: a } = await (i.length ? e.env.DB.prepare(r).bind(...i) : e.env.DB.prepare(r)).all();
	return e.json({
		matrices: a,
		total: a.length
	});
}), Y.get("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT * FROM rule_matrices WHERE id = ?").bind(t).first();
	return n ? e.json({ matrix: n }) : e.json({ error: "Matrix not found" }, 404);
}), Y.post("/", async (e) => {
	let t = await e.req.json(), n = R("rm"), r = z();
	return await e.env.DB.prepare("\n    INSERT INTO rule_matrices (\n      id, product_id, market_id, name, name_ar, description, description_ar,\n      row_dimension, row_dimension_label, row_dimension_ar,\n      col_dimension, col_dimension_label, col_dimension_ar,\n      grid_data, output_metric, output_unit,\n      is_active, regulatory_reference, source, ai_confidence,\n      created_by, created_at, updated_at\n    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, t.product_id || null, t.market_id || null, t.name, t.name_ar || null, t.description || null, t.description_ar || null, t.row_dimension, t.row_dimension_label || t.row_dimension, t.row_dimension_ar || null, t.col_dimension || null, t.col_dimension_label || null, t.col_dimension_ar || null, JSON.stringify(t.grid_data || []), t.output_metric, t.output_unit || null, t.is_active === !1 ? 0 : 1, t.regulatory_reference || null, t.source || "manual", t.ai_confidence || null, t.created_by || "u001", r, r).run(), await B(e.env.DB, {
		userId: t.created_by || "u001",
		userName: t.user_name || "System",
		userRole: t.user_role || "product_manager",
		action: "RULE_MATRIX_CREATED",
		entityType: "rule_matrix",
		entityId: n,
		details: {
			name: t.name,
			product_id: t.product_id
		}
	}), e.json({
		id: n,
		success: !0
	});
}), Y.patch("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z(), i = await e.env.DB.prepare("SELECT * FROM rule_matrices WHERE id = ?").bind(t).first();
	if (!i) return e.json({ error: "Matrix not found" }, 404);
	let a = [], o = [], s = (e, t) => {
		t !== void 0 && (a.push(`${e} = ?`), o.push(t));
	};
	return s("name", n.name), s("name_ar", n.name_ar), s("description", n.description), s("description_ar", n.description_ar), s("row_dimension", n.row_dimension), s("row_dimension_label", n.row_dimension_label), s("row_dimension_ar", n.row_dimension_ar), s("col_dimension", n.col_dimension), s("col_dimension_label", n.col_dimension_label), s("col_dimension_ar", n.col_dimension_ar), s("output_metric", n.output_metric), s("output_unit", n.output_unit), s("regulatory_reference", n.regulatory_reference), s("is_active", n.is_active === void 0 ? void 0 : +!!n.is_active), n.grid_data !== void 0 && (a.push("grid_data = ?"), o.push(JSON.stringify(n.grid_data))), a.length === 0 ? e.json({
		success: !0,
		message: "No changes"
	}) : (a.push("updated_at = ?"), o.push(r), o.push(t), await e.env.DB.prepare(`UPDATE rule_matrices SET ${a.join(", ")} WHERE id = ?`).bind(...o).run(), await B(e.env.DB, {
		userId: n.user_id || "u001",
		userName: n.user_name || "System",
		userRole: n.user_role || "product_manager",
		action: "RULE_MATRIX_UPDATED",
		entityType: "rule_matrix",
		entityId: t,
		details: { name: n.name || i.name }
	}), e.json({ success: !0 }));
}), Y.delete("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json().catch(() => ({})), r = await e.env.DB.prepare("SELECT * FROM rule_matrices WHERE id = ?").bind(t).first();
	return r ? (await e.env.DB.prepare("DELETE FROM rule_matrices WHERE id = ?").bind(t).run(), await B(e.env.DB, {
		userId: n.user_id || "u001",
		userName: n.user_name || "System",
		userRole: n.user_role || "product_manager",
		action: "RULE_MATRIX_DELETED",
		entityType: "rule_matrix",
		entityId: t,
		details: { name: r.name }
	}), e.json({ success: !0 })) : e.json({ error: "Matrix not found" }, 404);
}), Y.post("/:id/evaluate", async (e) => {
	let t = e.req.param("id"), { inputs: n } = await e.req.json(), r = await e.env.DB.prepare("SELECT * FROM rule_matrices WHERE id = ?").bind(t).first();
	if (!r) return e.json({ error: "Matrix not found" }, 404);
	let i = [];
	try {
		i = JSON.parse(r.grid_data || "[]");
	} catch {
		i = [];
	}
	let a = n?.[r.row_dimension], o = r.col_dimension ? n?.[r.col_dimension] : null, s = i.find((e) => {
		let t = e.row_key === a || e.row_min !== void 0 && e.row_max !== void 0 && Number(a) >= Number(e.row_min) && Number(a) <= Number(e.row_max);
		if (!r.col_dimension) return t;
		let n = e.col_key === o || e.col_min !== void 0 && e.col_max !== void 0 && Number(o) >= Number(e.col_min) && Number(o) <= Number(e.col_max);
		return t && n;
	});
	return e.json({
		matched: !!s,
		result: s ? s.value : null,
		result_label: s ? s.label : null,
		output_metric: r.output_metric,
		output_unit: r.output_unit,
		inputs: n,
		message: s ? `Match found: ${r.output_metric} = ${s.value}${r.output_unit || ""}` : "No matching cell for the provided inputs"
	});
});
//#endregion
//#region src/api/product-versions.ts
var X = new P(), nt = {
	1: {
		en: "Product Model",
		ar: "نموذج المنتج"
	},
	2: {
		en: "Core Configuration",
		ar: "الإعداد الأساسي"
	},
	3: {
		en: "Rule Builder",
		ar: "منشئ القواعد"
	},
	4: {
		en: "Workflow",
		ar: "سير العمل"
	},
	5: {
		en: "Compliance Mapping",
		ar: "رسم الامتثال"
	},
	6: {
		en: "Simulation",
		ar: "المحاكاة"
	}
};
X.get("/products/:productId/versions", async (e) => {
	let t = e.req.param("productId"), { results: n } = await e.env.DB.prepare("\n    SELECT id, product_id, version_number, stage, stage_name,\n           commit_message, created_by, created_by_name, created_by_role, created_at\n    FROM product_versions\n    WHERE product_id = ?\n    ORDER BY version_number DESC\n  ").bind(t).all();
	return e.json({
		versions: n,
		total: n.length
	});
}), X.get("/products/:productId/versions/:versionId", async (e) => {
	let { productId: t, versionId: n } = e.req.param(), r = await e.env.DB.prepare("\n    SELECT * FROM product_versions WHERE id = ? AND product_id = ?\n  ").bind(n, t).first();
	return r ? e.json({ version: r }) : e.json({ error: "Version not found" }, 404);
}), X.post("/products/:productId/versions/snapshot", async (e) => {
	let t = e.req.param("productId"), { stage: n, user_id: r, user_name: i, user_role: a } = await e.req.json();
	if (!n || !r) return e.json({ error: "stage and user_id are required" }, 400);
	let o = await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();
	if (!o) return e.json({ error: "Product not found" }, 404);
	let { results: s } = await e.env.DB.prepare("SELECT * FROM rules WHERE product_id = ?").bind(t).all(), { results: c } = await e.env.DB.prepare("SELECT * FROM rule_matrices WHERE product_id = ?").bind(t).all(), l = ((await e.env.DB.prepare("SELECT MAX(version_number) as max_v FROM product_versions WHERE product_id = ?").bind(t).first())?.max_v || 0) + 1, u = nt[n] || {
		en: `Stage ${n}`,
		ar: `المرحلة ${n}`
	}, d = {
		product: o,
		rules: s,
		matrices: c,
		snapshotAt: z(),
		stageCompleted: n,
		stageName: u.en
	}, f = `Completed ${u.en}`, p = e.env.OPENAI_API_KEY;
	if (p) try {
		let n = await e.env.DB.prepare("\n        SELECT snapshot FROM product_versions\n        WHERE product_id = ? ORDER BY version_number DESC LIMIT 1\n      ").bind(t).first(), r = {};
		if (n?.snapshot) try {
			r = JSON.parse(n.snapshot).product || {};
		} catch {}
		let i = [];
		for (let e of [
			"name",
			"description",
			"base_rate",
			"max_ltv",
			"max_dbr",
			"green_dbr",
			"min_term",
			"max_term",
			"min_amount",
			"max_amount",
			"gsas_min_score",
			"gsas_premium_score",
			"green_discount_standard",
			"green_discount_premium",
			"status",
			"schema"
		]) o[e] !== r[e] && o[e] !== void 0 && i.push(`${e}: ${r[e] ?? "unset"} → ${o[e]}`);
		let a = `You are writing a git commit message for a banking product configuration change.
Product: "${o.name}" (${o.category})
Stage completed: ${u.en}
Changed fields: ${i.length > 0 ? i.join(", ") : "configuration refinements"}
Rules count: ${s.length}
Matrices count: ${c.length}

Write a concise, professional 1-sentence commit message (max 80 chars) describing what was accomplished in this stage. 
Start with a verb (e.g. "Defined", "Configured", "Added", "Mapped", "Completed").
Output ONLY the commit message text, no quotes, no markdown.`, l = (await (await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${p}`,
				"Content-Type": "application/json"
			},
			body: JSON.stringify({
				model: "gpt-4o-mini",
				messages: [{
					role: "user",
					content: a
				}],
				temperature: .3,
				max_tokens: 60
			})
		})).json()).choices?.[0]?.message?.content?.trim();
		l && (f = l);
	} catch {}
	let m = R("pv"), h = z();
	return await e.env.DB.prepare("\n    INSERT INTO product_versions (\n      id, product_id, version_number, stage, stage_name,\n      snapshot, commit_message, created_by, created_by_name, created_by_role, created_at\n    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(m, t, l, n, u.en, JSON.stringify(d), f, r, i || r, a || "product_manager", h).run(), await e.env.DB.prepare("\n    UPDATE products SET pge_stage = MAX(COALESCE(pge_stage, 0), ?), updated_at = ?\n    WHERE id = ?\n  ").bind(n, h, t).run(), await B(e.env.DB, {
		userId: r,
		userName: i || r,
		userRole: a || "product_manager",
		action: "PRODUCT_VERSION_SNAPSHOT",
		entityType: "product",
		entityId: t,
		details: {
			version: l,
			stage: n,
			stage_name: u.en,
			commit_message: f
		}
	}), e.json({
		id: m,
		version_number: l,
		commit_message: f,
		success: !0
	});
}), X.post("/products/:productId/versions/:versionId/revert", async (e) => {
	let { productId: t, versionId: n } = e.req.param(), r = await e.req.json(), i = await e.env.DB.prepare("SELECT * FROM product_versions WHERE id = ? AND product_id = ?").bind(n, t).first();
	if (!i) return e.json({ error: "Version not found" }, 404);
	let a = {};
	try {
		a = JSON.parse(i.snapshot);
	} catch {
		return e.json({ error: "Invalid snapshot data" }, 500);
	}
	let o = a.product || {}, s = z();
	await e.env.DB.prepare("\n    UPDATE products SET\n      name = ?, description = ?, base_rate = ?, max_ltv = ?, max_dbr = ?,\n      green_dbr = ?, min_term = ?, max_term = ?, min_amount = ?, max_amount = ?,\n      gsas_min_score = ?, gsas_premium_score = ?, green_discount_standard = ?,\n      green_discount_premium = ?, ai_confidence_threshold = ?,\n      required_docs = ?, esg_required_docs = ?, approved_materials = ?,\n      approved_vendors = ?, configuration = ?, schema = ?,\n      workflow_nodes = ?, workflow_edges = ?, workflow_template_id = ?,\n      pge_stage = ?, updated_at = ?\n    WHERE id = ?\n  ").bind(o.name, o.description, o.base_rate, o.max_ltv, o.max_dbr, o.green_dbr, o.min_term, o.max_term, o.min_amount, o.max_amount, o.gsas_min_score, o.gsas_premium_score, o.green_discount_standard, o.green_discount_premium, o.ai_confidence_threshold, o.required_docs, o.esg_required_docs, o.approved_materials, o.approved_vendors, o.configuration, o.schema || "{}", o.workflow_nodes || "[]", o.workflow_edges || "[]", o.workflow_template_id || null, i.stage, s, t).run();
	let c = await e.env.DB.prepare("SELECT MAX(version_number) as max_v FROM product_versions WHERE product_id = ?").bind(t).first();
	return await e.env.DB.prepare("\n    INSERT INTO product_versions (\n      id, product_id, version_number, stage, stage_name,\n      snapshot, commit_message, created_by, created_by_name, created_by_role, created_at\n    ) VALUES (?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(R("pv"), t, (c?.max_v || 0) + 1, i.stage, i.stage_name, JSON.stringify(a), `Reverted to v${i.version_number}: "${i.commit_message}"`, r.user_id || "u001", r.user_name || "System", r.user_role || "product_manager", s).run(), await B(e.env.DB, {
		userId: r.user_id || "u001",
		userName: r.user_name || "System",
		userRole: r.user_role || "product_manager",
		action: "PRODUCT_VERSION_REVERTED",
		entityType: "product",
		entityId: t,
		details: {
			reverted_to_version: i.version_number,
			commit: i.commit_message
		}
	}), e.json({
		success: !0,
		reverted_to_version: i.version_number
	});
});
//#endregion
//#region src/api/compliance-tags.ts
var Z = new P();
Z.get("/", async (e) => {
	let t = e.req.query("market_id"), n = e.req.query("category"), r = e.req.query("product_category"), i = "SELECT * FROM compliance_tags WHERE 1=1", a = [];
	t && (i += " AND (market_id = ? OR market_id IS NULL)", a.push(t)), n && (i += " AND category = ?", a.push(n)), i += " ORDER BY category, name ASC";
	let { results: o } = await (a.length ? e.env.DB.prepare(i).bind(...a) : e.env.DB.prepare(i)).all();
	return r && (o = o.filter((e) => {
		try {
			let t = JSON.parse(e.applies_to || "[]");
			return t.length === 0 || t.includes(r);
		} catch {
			return !0;
		}
	})), e.json({
		tags: o,
		total: o.length
	});
}), Z.get("/product/:productId", async (e) => {
	let t = e.req.param("productId"), { results: n } = await e.env.DB.prepare("\n    SELECT ct.*, pct.mapped_at, pct.mapped_by\n    FROM compliance_tags ct\n    JOIN product_compliance_tags pct ON pct.tag_id = ct.id\n    WHERE pct.product_id = ?\n    ORDER BY ct.category, ct.name\n  ").bind(t).all();
	return e.json({
		tags: n,
		total: n.length
	});
}), Z.get("/product/:productId/gap-analysis", async (e) => {
	let t = e.req.param("productId"), n = await e.env.DB.prepare("SELECT * FROM products WHERE id = ?").bind(t).first();
	if (!n) return e.json({ error: "Product not found" }, 404);
	let { results: r } = await e.env.DB.prepare("\n    SELECT * FROM compliance_tags\n    WHERE (market_id = ? OR market_id IS NULL)\n    AND severity = 'mandatory'\n    AND is_active = 1\n  ").bind(n.market_id || "mkt001").all(), { results: i } = await e.env.DB.prepare("\n    SELECT tag_id FROM product_compliance_tags WHERE product_id = ?\n  ").bind(t).all(), a = new Set(i.map((e) => e.tag_id)), o = r.filter((e) => {
		if (a.has(e.id)) return !1;
		try {
			let t = JSON.parse(e.applies_to || "[]");
			return t.length === 0 || t.includes(n.category);
		} catch {
			return !1;
		}
	}), s = r.filter((e) => {
		try {
			let t = JSON.parse(e.applies_to || "[]");
			return t.length === 0 || t.includes(n.category);
		} catch {
			return !1;
		}
	}), c = s.filter((e) => a.has(e.id)).length;
	return e.json({
		gaps: o,
		gaps_count: o.length,
		covered_count: c,
		total_applicable: s.length,
		coverage_pct: s.length > 0 ? Math.round(c / s.length * 100) : 100
	});
}), Z.post("/product/:productId/map", async (e) => {
	let t = e.req.param("productId"), { tag_ids: n, user_id: r, user_name: i } = await e.req.json();
	if (!n?.length) return e.json({ error: "tag_ids array is required" }, 400);
	for (let i of n) await e.env.DB.prepare("\n      INSERT OR IGNORE INTO product_compliance_tags (product_id, tag_id, mapped_by, mapped_at)\n      VALUES (?,?,?,?)\n    ").bind(t, i, r || "u001", z()).run();
	return await B(e.env.DB, {
		userId: r || "u001",
		userName: i || "System",
		userRole: "product_manager",
		action: "COMPLIANCE_TAGS_MAPPED",
		entityType: "product",
		entityId: t,
		details: { tag_ids: n }
	}), e.json({
		success: !0,
		mapped_count: n.length
	});
}), Z.delete("/product/:productId/map/:tagId", async (e) => {
	let { productId: t, tagId: n } = e.req.param(), r = await e.req.json().catch(() => ({}));
	return await e.env.DB.prepare("DELETE FROM product_compliance_tags WHERE product_id = ? AND tag_id = ?").bind(t, n).run(), await B(e.env.DB, {
		userId: r.user_id || "u001",
		userName: r.user_name || "System",
		userRole: "product_manager",
		action: "COMPLIANCE_TAG_UNMAPPED",
		entityType: "product",
		entityId: t,
		details: { tag_id: n }
	}), e.json({ success: !0 });
}), Z.post("/", async (e) => {
	let t = await e.req.json(), n = R("ct"), r = z();
	return await e.env.DB.prepare("\n    INSERT INTO compliance_tags (\n      id, market_id, code, name, name_ar, description, description_ar,\n      category, regulatory_reference, severity, applies_to, is_active, created_at\n    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, t.market_id || "mkt001", t.code?.toUpperCase() || n, t.name, t.name_ar || null, t.description || null, t.description_ar || null, t.category || "general", t.regulatory_reference || null, t.severity || "mandatory", JSON.stringify(t.applies_to || []), 1, r).run(), e.json({
		id: n,
		success: !0
	});
}), Z.patch("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = [], i = [], a = (e, t) => {
		t !== void 0 && (r.push(`${e} = ?`), i.push(t));
	};
	return a("name", n.name), a("name_ar", n.name_ar), a("description", n.description), a("description_ar", n.description_ar), a("category", n.category), a("regulatory_reference", n.regulatory_reference), a("severity", n.severity), n.applies_to !== void 0 && (r.push("applies_to = ?"), i.push(JSON.stringify(n.applies_to))), n.is_active !== void 0 && (r.push("is_active = ?"), i.push(+!!n.is_active)), r.length ? (i.push(t), await e.env.DB.prepare(`UPDATE compliance_tags SET ${r.join(", ")} WHERE id = ?`).bind(...i).run(), e.json({ success: !0 })) : e.json({ success: !0 });
}), Z.delete("/:id", async (e) => (await e.env.DB.prepare("DELETE FROM compliance_tags WHERE id = ?").bind(e.req.param("id")).run(), e.json({ success: !0 })));
//#endregion
//#region src/api/workflow-templates.ts
var Q = new P();
Q.get("/", async (e) => {
	let t = e.req.query("market_id"), n = e.req.query("category"), r = "SELECT id, market_id, name, name_ar, description, description_ar, category, is_system, is_active, created_by, created_at FROM workflow_templates WHERE 1=1", i = [];
	t && (r += " AND (market_id = ? OR market_id IS NULL)", i.push(t)), n && (r += " AND category = ?", i.push(n)), r += " ORDER BY is_system DESC, name ASC";
	let { results: a } = await (i.length ? e.env.DB.prepare(r).bind(...i) : e.env.DB.prepare(r)).all();
	return e.json({
		templates: a,
		total: a.length
	});
}), Q.get("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT * FROM workflow_templates WHERE id = ?").bind(t).first();
	return n ? e.json({ template: n }) : e.json({ error: "Template not found" }, 404);
}), Q.post("/", async (e) => {
	let t = await e.req.json(), n = R("wft"), r = z();
	return await e.env.DB.prepare("\n    INSERT INTO workflow_templates (\n      id, market_id, name, name_ar, description, description_ar, category,\n      nodes, edges, is_system, is_active, created_by, created_at, updated_at\n    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)\n  ").bind(n, t.market_id || "mkt001", t.name, t.name_ar || null, t.description || null, t.description_ar || null, t.category || "general", JSON.stringify(t.nodes || []), JSON.stringify(t.edges || []), 0, 1, t.created_by || "u001", r, r).run(), await B(e.env.DB, {
		userId: t.created_by || "u001",
		userName: t.user_name || "System",
		userRole: t.user_role || "product_manager",
		action: "WORKFLOW_TEMPLATE_CREATED",
		entityType: "workflow_template",
		entityId: n,
		details: { name: t.name }
	}), e.json({
		id: n,
		success: !0
	});
}), Q.patch("/:id", async (e) => {
	let t = e.req.param("id"), n = await e.req.json(), r = z(), i = await e.env.DB.prepare("SELECT * FROM workflow_templates WHERE id = ?").bind(t).first();
	if (!i) return e.json({ error: "Template not found" }, 404);
	if (i.is_system) return e.json({ error: "System templates cannot be modified" }, 403);
	let a = [], o = [], s = (e, t) => {
		t !== void 0 && (a.push(`${e} = ?`), o.push(t));
	};
	return s("name", n.name), s("name_ar", n.name_ar), s("description", n.description), s("description_ar", n.description_ar), s("category", n.category), n.nodes !== void 0 && (a.push("nodes = ?"), o.push(JSON.stringify(n.nodes))), n.edges !== void 0 && (a.push("edges = ?"), o.push(JSON.stringify(n.edges))), n.is_active !== void 0 && (a.push("is_active = ?"), o.push(+!!n.is_active)), a.length ? (a.push("updated_at = ?"), o.push(r), o.push(t), await e.env.DB.prepare(`UPDATE workflow_templates SET ${a.join(", ")} WHERE id = ?`).bind(...o).run(), e.json({ success: !0 })) : e.json({ success: !0 });
}), Q.delete("/:id", async (e) => {
	let t = await e.env.DB.prepare("SELECT * FROM workflow_templates WHERE id = ?").bind(e.req.param("id")).first();
	return t ? t.is_system ? e.json({ error: "System templates cannot be deleted" }, 403) : (await e.env.DB.prepare("DELETE FROM workflow_templates WHERE id = ?").bind(e.req.param("id")).run(), e.json({ success: !0 })) : e.json({ error: "Not found" }, 404);
}), Q.post("/:id/validate", async (e) => {
	let t = e.req.param("id"), n = await e.env.DB.prepare("SELECT * FROM workflow_templates WHERE id = ?").bind(t).first();
	if (!n) return e.json({ error: "Template not found" }, 404);
	let r = [], i = [];
	try {
		r = JSON.parse(n.nodes || "[]");
	} catch {}
	try {
		i = JSON.parse(n.edges || "[]");
	} catch {}
	return e.json(rt(r, i));
}), Q.post("/validate/inline", async (e) => {
	let { nodes: t, edges: n } = await e.req.json();
	return e.json(rt(t || [], n || []));
});
function rt(e, t) {
	let n = [], r = [], i = new Set(e.map((e) => e.id)), a = new Set(t.map((e) => e.from)), o = new Set(t.map((e) => e.to)), s = e.filter((e) => e.type === "start"), c = e.filter((e) => e.type === "end");
	s.length === 0 && n.push({
		type: "missing_start",
		severity: "error",
		message: "Workflow must have a Start node",
		message_ar: "يجب أن يحتوي سير العمل على عقدة بداية"
	}), s.length > 1 && n.push({
		type: "multiple_start",
		severity: "error",
		message: "Workflow can only have one Start node",
		message_ar: "لا يمكن أن يحتوي سير العمل على أكثر من عقدة بداية واحدة"
	}), c.length === 0 && n.push({
		type: "missing_end",
		severity: "error",
		message: "Workflow must have an End node",
		message_ar: "يجب أن يحتوي سير العمل على عقدة نهاية"
	});
	for (let t of e) {
		if (t.type === "start") continue;
		let e = o.has(t.id), r = a.has(t.id);
		!e && !r && n.push({
			type: "orphan_node",
			severity: "error",
			node_id: t.id,
			message: `Node "${t.label}" is not connected to any other node`,
			message_ar: `العقدة "${t.label_ar || t.label}" غير متصلة بأي عقدة أخرى`
		});
	}
	for (let t of e) t.type === "task" && !t.auto && !t.role && r.push({
		type: "unassigned_task",
		severity: "warning",
		node_id: t.id,
		message: `Task "${t.label}" has no assigned role`,
		message_ar: `المهمة "${t.label_ar || t.label}" ليس لها دور مُعيَّن`
	});
	for (let t of e) t.type !== "end" && (a.has(t.id) || n.push({
		type: "dead_end",
		severity: "error",
		node_id: t.id,
		message: `Node "${t.label}" has no outgoing connections`,
		message_ar: `العقدة "${t.label_ar || t.label}" ليس لها اتصالات صادرة`
	}));
	for (let e of t) i.has(e.from) || n.push({
		type: "broken_edge",
		severity: "error",
		message: `Edge references non-existent source node: ${e.from}`,
		message_ar: `الحافة تشير إلى عقدة مصدر غير موجودة: ${e.from}`
	}), i.has(e.to) || n.push({
		type: "broken_edge",
		severity: "error",
		message: `Edge references non-existent target node: ${e.to}`,
		message_ar: `الحافة تشير إلى عقدة هدف غير موجودة: ${e.to}`
	});
	let l = n.length === 0;
	return {
		valid: l,
		issues: n,
		warnings: r,
		summary: l ? r.length > 0 ? `Valid with ${r.length} warning(s)` : "Workflow is valid" : `${n.length} error(s) found`
	};
}
//#endregion
//#region src/index.tsx
var it = {
	DB: L,
	OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
	GOOGLE_VISION_API_KEY: process.env.GOOGLE_VISION_API_KEY || "",
	DEMO_MODE: process.env.DEMO_MODE || "true"
}, $ = new P();
$.use("/api/*", Ie()), $.use("*", async (e, t) => {
	e.set("env", it), Object.assign(e, { env: it }), await t();
}), $.route("/api/v1/products", V), $.route("/api/v1/applications", H), $.route("/api/v1/ai", U), $.route("/api/v1/compliance", W), $.route("/api/v1/projects", G), $.route("/api/v1/documents", Je), $.route("/api/v1/escrow", Xe), $.route("/api/v1/audit", Ze), $.route("/api/v1/users", K), $.route("/api/v1/seed", Qe), $.route("/api/v1/portal", q), $.route("/api/v1/markets", J), $.route("/api/v1/rule-matrices", Y), $.route("/api/v1/compliance-tags", Z), $.route("/api/v1/workflow-templates", Q), $.route("/api/v1", X), $.get("/api/v1/img-proxy", async (e) => {
	let t = e.req.query("url");
	if (!t || !t.startsWith("https://www.genspark.ai/")) return e.text("Invalid URL", 400);
	try {
		let n = await fetch(t, { headers: { "User-Agent": "Mozilla/5.0" } });
		if (!n.ok) return e.text("Image fetch failed", 502);
		let r = n.headers.get("content-type") || "image/jpeg", i = await n.arrayBuffer();
		return new Response(i, { headers: {
			"Content-Type": r,
			"Cache-Control": "public, max-age=86400",
			"Access-Control-Allow-Origin": "*"
		} });
	} catch {
		return e.text("Proxy error", 502);
	}
}), $.get("/api/v1/rules", async (e) => {
	let t = e.req.query("product_id"), n = e.req.query("category"), r = "SELECT * FROM rules WHERE 1=1", i = [];
	t && (r += " AND (product_id = ? OR product_id IS NULL)", i.push(t)), n && (r += " AND category = ?", i.push(n)), r += " ORDER BY category, name";
	let { results: a } = await (i.length ? L.prepare(r).bind(...i) : L.prepare(r)).all();
	return e.json({
		rules: a,
		total: a.length
	});
}), $.get("/api/v1/customers", async (e) => {
	let { results: t } = await L.prepare("SELECT * FROM customers ORDER BY name").all();
	return e.json({
		customers: t,
		total: t.length
	});
}), $.get("/api/v1/customers/:id", async (e) => {
	let t = e.req.param("id"), n = await L.prepare("SELECT * FROM customers WHERE id = ?").bind(t).first();
	return n ? e.json({ customer: n }) : e.json({ error: "Not found" }, 404);
});
var at = "efa1036";
$.use("*", async (e, t) => {
	let n = e.req.path;
	if (!(n.endsWith(".html") && n.startsWith("/portals/"))) {
		await t();
		return;
	}
	let r = a.join(process.cwd(), "dist", n);
	if (!i.existsSync(r)) {
		await t();
		return;
	}
	if (e.req.query("v") !== at) {
		let t = e.req.url.startsWith("http") ? e.req.url : `http://localhost${e.req.url}`, n = new URL(t);
		return n.searchParams.set("v", at), e.newResponse(null, 302, {
			Location: n.pathname + n.search,
			"Clear-Site-Data": "\"cache\", \"cookies\", \"storage\"",
			"Cache-Control": "no-store"
		});
	}
	let o = i.readFileSync(r, "utf-8");
	return e.html(o, 200, {
		"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
		Pragma: "no-cache",
		Expires: "0",
		"Clear-Site-Data": "\"cache\""
	});
}), $.use("/*", e({ root: "./dist" }));
//#endregion
export { $ as default, it as env };
