/* =========================================================================
   Harman Manik — portfolio
   Scroll-driven day→night scene + procedural sky/skyline + reveals.
   Vanilla JS, no dependencies.
   ========================================================================= */
(() => {
    "use strict";

    const root = document.documentElement;
    const body = document.body;

    /* ---- small math helpers ---- */
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const lerp = (a, b, t) => a + (b - a) * t;
    // smoothstep between edges e0..e1
    const smooth = (e0, e1, x) => {
        const t = clamp((x - e0) / (e1 - e0));
        return t * t * (3 - 2 * t);
    };
    // deterministic PRNG so the skyline/stars are stable across reloads
    const rng = (() => {
        let s = 1337;
        return () => {
            s = (s * 1664525 + 1013904223) & 0x7fffffff;
            return s / 0x7fffffff;
        };
    })();

    /* =====================================================================
       1. PROCEDURAL STARFIELD
       ===================================================================== */
    (function stars() {
        const g = document.querySelector(".stars svg g");
        if (!g) return;
        const NS = "http://www.w3.org/2000/svg";
        let frag = "";
        for (let i = 0; i < 110; i++) {
            const x = (rng() * 1440).toFixed(1);
            const y = (rng() * 560).toFixed(1);
            const r = (0.4 + rng() * 1.5).toFixed(2);
            const o = (0.4 + rng() * 0.6).toFixed(2);
            frag += `<circle cx="${x}" cy="${y}" r="${r}" opacity="${o}"/>`;
        }
        g.innerHTML = frag;
        void NS; // (kept for clarity; innerHTML path used for brevity)
    })();

    /* =====================================================================
       2. WINDOW LIGHTS on the modern Gurugram towers
          (Delhi monuments are hand-authored in index.html; here we just
           sprinkle lit windows into the glass towers, appended so the
           static monument uplights are preserved.)
       ===================================================================== */
    (function cityLights() {
        const windows = document.querySelector(".city-windows");
        if (!windows) return;

        // {x, top, w} for each tower — bottom sits on the baseline (y=252)
        const towers = [
            { x: 1160, top: 102, w: 60 },
            { x: 1250, top: 144, w: 52 },
            { x: 1330, top: 80, w: 86 },
        ];
        const pad = 8;
        const cell = 12;
        let str = "";
        for (const t of towers) {
            for (let wy = t.top + pad; wy < 252 - pad; wy += cell) {
                for (let wx = t.x + pad; wx < t.x + t.w - pad; wx += cell) {
                    if (rng() > 0.45) {              // ~55% of windows lit
                        str += `<rect x="${wx}" y="${wy}" width="5" height="6"/>`;
                    }
                }
            }
        }
        windows.insertAdjacentHTML("beforeend", str);
    })();

    /* =====================================================================
       2b. DYNAMIC CLOUDS
          Turn the single cloud PNG into two continuously-drifting depth
          fields (seamless right-loop via duplicated copies). Each field also
          reacts to scroll differently (far sinks down, near slides right) and
          to the mouse (via the .clouds container). Falls back to the CSS
          clouds if no image is present.
       ===================================================================== */
    (function buildClouds() {
        const el = document.querySelector(".clouds");
        if (!el) return;
        const img = el.querySelector(".scene-img");
        if (!img) return;
        const src = img.getAttribute("src");
        const build = () => {
            if (el.dataset.built) return;
            el.dataset.built = "1";
            el.classList.add("has-img");
            img.remove();
            for (const depth of ["far"]) {
                const scroll = document.createElement("div");
                scroll.className = "cloud-scroll cloud-scroll--" + depth;
                // single feathered image (no duplicate copies → NO seam); it gently
                // sways within its overhang and moves with scroll + mouse
                const cimg = document.createElement("img");
                cimg.className = "cloud-img cloud-img--" + depth;
                cimg.alt = "";
                cimg.src = src;
                scroll.appendChild(cimg);
                el.appendChild(scroll);
            }
        };
        if (img.complete && img.naturalWidth) build();
        else img.addEventListener("load", build);
        // if the image 404s, its inline onerror removes it and CSS clouds stay
    })();

    /* =====================================================================
       3. SCROLL-DRIVEN SCENE
       ===================================================================== */
    let forcedNight = false;
    let ticking = false;

    function apply(p) {
        // three distinct phases: DAY (fades ~0.1–0.45) → EVENING/sunset (peaks
        // ~0.55) → NIGHT (rises ~0.6, complete by 0.9)
        const sunO = 1 - smooth(0.10, 0.45, p);
        const duskO = smooth(0.14, 0.5, p) * (1 - smooth(0.64, 0.9, p));
        const nightO = smooth(0.6, 0.9, p);
        const starsO = smooth(0.68, 0.95, p);
        const lightsO = smooth(0.6, 0.9, p);
        // scene title cross-fades from "Harman Manik" → "Masters' Union · Gurugram"
        // as the buildings rise; 0 = name, 1 = studying-at line
        const titleSwap = smooth(0.12, 0.5, p);

        // celestial positions (in vh)
        const sunT = clamp(p / 0.60);
        const sunY = lerp(24, 126, sunT);
        const moonT = clamp((p - 0.45) / 0.55);
        // moon rises in an ARC: sweeps left→right while curving up (sine ease)
        const moonX = lerp(18, 80, moonT);                          // left %
        const moonY = 98 - Math.sin(moonT * Math.PI / 2) * 82;       // top vh (curved)

        root.style.setProperty("--p", p.toFixed(3));
        root.style.setProperty("--sun-o", sunO.toFixed(3));
        root.style.setProperty("--dusk-o", duskO.toFixed(3));
        root.style.setProperty("--night-o", nightO.toFixed(3));
        root.style.setProperty("--stars-o", starsO.toFixed(3));
        root.style.setProperty("--lights-o", lightsO.toFixed(3));
        root.style.setProperty("--title-swap", titleSwap.toFixed(3));
        // z-order: title tucks BEHIND the mountains only while emerging; it rides
        // OVER all layers once out (swap≈1) and at the very top (swap≈0, so
        // "Harman Manik" clears the clouds)
        if (sceneTitle) sceneTitle.classList.toggle("title-front", titleSwap < 0.1 || titleSwap > 0.88);
        root.style.setProperty("--sun-y", sunY.toFixed(1));
        root.style.setProperty("--moon-y", moonY.toFixed(1));
        root.style.setProperty("--moon-x", moonX.toFixed(1));
        root.style.setProperty("--mtn-dark", nightO.toFixed(3));

        // layers rise up from below as you scroll into the scene, over the first
        // ~half of the transition (hills rise first, city rises most), then night
        const riseP = clamp(p / 0.5);
        root.style.setProperty("--city-rise", ((1 - riseP) * 72).toFixed(2));
        root.style.setProperty("--hills-rise", ((1 - riseP) * 40).toFixed(2));
        root.style.setProperty("--metro-rise", ((1 - riseP) * 80).toFixed(2));
        root.style.setProperty("--fig-rise", ((1 - riseP) * 90).toFixed(2));
        // figure + cliff slide IN from the right as you scroll (in vw)
        root.style.setProperty("--fig-in", ((1 - riseP) * 62).toFixed(2));

        // text flips to light once the layered scene is mostly night
        root.style.setProperty("--fg", nightO > 0.5 ? "var(--paper)" : "var(--ink)");
    }

    function scrollProgress() {
        // day→night completes ~1.4 screens in; then night holds while the whole
        // scene releases and travels up (see --scene-up in frame())
        return clamp(window.scrollY / (window.innerHeight * 1.4));
    }

    /* ---- pinned decks (scroll-sequenced pillars) + hero parallax ---- */
    const decks = [...document.querySelectorAll("[data-deck]")].map((el) => ({
        el,
        steps: parseInt(el.dataset.steps || "1", 10),
        pillars: [...el.querySelectorAll(".pillar")],
        dots: [...el.querySelectorAll(".rail-dot")],
    }));

    const sceneTitle = document.querySelector(".scene-title");
    const zoomAct = document.querySelector(".zoom-act");
    const heroTitle = document.querySelector(".hero-title");
    const heroSub = document.querySelector(".hero-sub");
    const heroCue = document.querySelector(".hero-scroll");

    function updateDecks() {
        const vh = window.innerHeight;
        for (const d of decks) {
            const rect = d.el.getBoundingClientRect();
            const total = d.el.offsetHeight - vh;
            const dp = clamp(-rect.top / (total || 1));
            d.el.style.setProperty("--dp", dp.toFixed(4));
            const active = Math.min(d.steps - 1, Math.max(0, Math.floor(dp * d.steps)));
            d.pillars.forEach((p, i) => {
                p.classList.toggle("is-active", i === active);
                p.classList.toggle("is-past", i < active);
            });
            d.dots.forEach((dot, i) => dot.classList.toggle("is-on", i === active));
        }
    }

    function heroParallax(y) {
        if (!heroTitle) return;
        if (y == null) y = window.scrollY;
        const fade = clamp(1 - y / (window.innerHeight * 0.75));
        heroTitle.style.transform = `translateY(${(y * 0.12).toFixed(1)}px)`;
        heroTitle.style.opacity = (0.12 + 0.88 * fade).toFixed(3);
        if (heroSub) heroSub.style.opacity = (0.82 * fade).toFixed(3);
        if (heroCue) heroCue.style.opacity = (0.6 * fade).toFixed(3);
    }

    let zoomOriginSet = false;
    function measureZoomOrigin() {
        const stage = zoomAct && zoomAct.querySelector(".zoom-stage");
        const em = zoomAct && (zoomAct.querySelector(".zoom-line .zdot") || zoomAct.querySelector(".zoom-line em"));
        if (!stage || !em) return;
        const sr = stage.getBoundingClientRect(), er = em.getBoundingClientRect();
        if (sr.width < 1) return;
        const zx = ((er.left + er.width / 2) - sr.left) / sr.width * 100;
        const zy = ((er.top + er.height / 2) - sr.top) / sr.height * 100;
        zoomAct.style.setProperty("--zx", zx.toFixed(1) + "%");
        zoomAct.style.setProperty("--zy", zy.toFixed(1) + "%");
        zoomOriginSet = true;
    }
    function updateZoom(dy) {
        if (!zoomAct) return;
        const vh = window.innerHeight;
        const r = zoomAct.getBoundingClientRect();
        const total = zoomAct.offsetHeight - vh;
        const top = r.top + (dy || 0);   // drive from the damped (smoothed) scroll position
        const p = clamp(-top / (total || 1));
        const z = smooth(0.05, 0.8, p) * 352;   // text flies straight toward you
        const fill = smooth(0.6, 0.97, p);      // cream completes right at the end → straight into projects
        zoomAct.style.setProperty("--z", z.toFixed(1) + "px");
        zoomAct.style.setProperty("--fill", fill.toFixed(3));
    }

    // ---- smooth, damped scroll engine: a continuous rAF loop eases a "smoothY"
    // value toward the real scroll position and drives every scroll-linked
    // animation from it, so the scene + zoom feel fluid instead of raw/steppy ----
    let smoothY = window.pageYOffset || 0;
    function tick() {
        const realY = window.pageYOffset || 0;
        smoothY += (realY - smoothY) * 0.12;                 // damping (lower = smoother/heavier)
        if (Math.abs(realY - smoothY) < 0.08) smoothY = realY;
        const dy = realY - smoothY;                          // how far the eased value lags behind
        if (!forcedNight) apply(clamp(smoothY / (window.innerHeight * 1.4)));
        updateDecks();
        updateZoom(dy);
        heroParallax(smoothY);
        const up = Math.max(0, smoothY - window.innerHeight * 1.8);
        root.style.setProperty("--scene-up", up.toFixed(1));
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    window.addEventListener("resize", () => { zoomOriginSet = false; }, { passive: true });

    // ---- mouse parallax: each scene layer drifts a different amount ----
    let mx = 0, my = 0, mtick = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion) {
        window.addEventListener("mousemove", (e) => {
            mx = (e.clientX / window.innerWidth - 0.5) * 2;   // -1 .. 1
            my = (e.clientY / window.innerHeight - 0.5) * 2;
            if (mtick) return;
            mtick = true;
            requestAnimationFrame(() => {
                root.style.setProperty("--mx", mx.toFixed(3));
                root.style.setProperty("--my", my.toFixed(3));
                mtick = false;
            });
        }, { passive: true });
    }

    // rail dots jump to a pillar's scroll band
    for (const d of decks) {
        d.dots.forEach((dot, i) => {
            dot.addEventListener("click", () => {
                const total = d.el.offsetHeight - window.innerHeight;
                const target = d.el.offsetTop + ((i + 0.5) / d.steps) * total;
                window.scrollTo({ top: target, behavior: "smooth" });
            });
        });
    }

    /* =====================================================================
       4. THEME TOGGLE  (force permanent night, or resume scroll-driven)
       ===================================================================== */
    const toggle = document.getElementById("themeToggle");
    if (toggle) {
        const setLabel = () => (toggle.textContent = forcedNight ? "day" : "night");
        // restore preference
        forcedNight = localStorage.getItem("forceNight") === "1";
        toggle.addEventListener("click", () => {
            forcedNight = !forcedNight;
            localStorage.setItem("forceNight", forcedNight ? "1" : "0");
            setLabel();
            if (forcedNight) apply(1);
            else apply(scrollProgress());
        });
        setLabel();
        if (forcedNight) apply(1);
    }

    /* =====================================================================
       5. REVEAL-ON-SCROLL
       ===================================================================== */
    const reveals = document.querySelectorAll(".reveal");
    if ("IntersectionObserver" in window && reveals.length) {
        const io = new IntersectionObserver(
            (entries, obs) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add("in");
                        obs.unobserve(e.target);
                    }
                }
            },
            { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
        );
        reveals.forEach((el) => io.observe(el));
    } else {
        reveals.forEach((el) => el.classList.add("in"));
    }

    /* =====================================================================
       6. MISC
       ===================================================================== */
    const yr = document.getElementById("year");
    if (yr) yr.textContent = new Date().getFullYear();

    // initial paint (scene + decks + hero)
    if (!forcedNight) apply(scrollProgress());
    updateDecks();
    updateZoom();
    heroParallax();

    // kick off the load choreography (mountains → clouds → title) on refresh
    setTimeout(() => body.classList.add("ready"), 80);
})();

/* =========================================================================
   PROJECT SHOWCASE — subtle 3D tilt toward the cursor (hover devices only)
   Applied to .feat-inner so it composes with the scroll-reveal on .feat.
   ========================================================================= */
(function featTilt() {
    const feats = document.querySelectorAll(".feat");
    if (!feats.length) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

    feats.forEach((feat) => {
        const inner = feat.querySelector(".feat-inner");
        if (!inner) return;
        let raf = false, px = 0, py = 0;
        const apply = () => {
            inner.style.transform = `rotateX(${(-py * 3.4).toFixed(2)}deg) rotateY(${(px * 4.6).toFixed(2)}deg)`;
            raf = false;
        };
        feat.addEventListener("mousemove", (e) => {
            const r = feat.getBoundingClientRect();
            px = (e.clientX - r.left) / r.width - 0.5;
            py = (e.clientY - r.top) / r.height - 0.5;
            if (!raf) { raf = true; requestAnimationFrame(apply); }
        }, { passive: true });
        feat.addEventListener("mouseleave", () => { inner.style.transform = ""; });
    });
})();
