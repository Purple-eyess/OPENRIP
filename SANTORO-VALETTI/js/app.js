/**
 * app.js
 * Santoro Valetti - Scroll-Driven Video Landing Page
 * GSAP + ScrollTrigger + Lenis
 */

document.addEventListener("DOMContentLoaded", () => {
    // === 1. Lenis Smooth Scroll Setup ===
    const lenis = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        orientation: 'vertical',
        gestureOrientation: 'vertical',
        wheelMultiplier: 1,
        touchMultiplier: 2,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
        lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Smooth scroll for nav links & hero CTA
    document.querySelectorAll('a[href^="#"], #hero-btn').forEach(anchor => {
        let el = anchor;
        if (anchor.id === 'hero-btn') el = { getAttribute: () => '#reserva' };

        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = el.getAttribute('href');
            if (targetId === '#') return;

            // For scroll-trigger sections, we need to scroll to the corresponding percentage
            // of the #scroll-container height since they are fixed/absolute and revealed by scroll
            const targetSection = document.querySelector(targetId);
            if (targetSection && targetSection.classList.contains('scroll-section')) {
                const enterPct = parseFloat(targetSection.dataset.enter) / 100;
                const scrollContainer = document.getElementById('scroll-container');
                const targetY = scrollContainer.getBoundingClientRect().top + window.scrollY + (scrollContainer.offsetHeight * enterPct);
                lenis.scrollTo(targetY + window.innerHeight * 0.2); // Add a bit of offset
            } else if (targetSection) {
                lenis.scrollTo(targetSection);
            }
        });
    });

    // === 2. Video Frame Preloader ===
    const FRAME_COUNT = 192; // Based on new ffmpeg extraction
    const frames = [];
    let loadedFrames = 0;
    const loader = document.getElementById('loader');
    const loaderBar = document.getElementById('loader-bar');
    const loaderPercent = document.getElementById('loader-percent');

    // We expect frames to be named frame_0001.webp to frame_0145.webp
    function pad(num, size) {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
    }

    function loadFrames() {
        for (let i = 1; i <= FRAME_COUNT; i++) {
            const img = new Image();
            img.src = `frames/frame_${pad(i, 4)}.webp`;
            img.onload = () => {
                loadedFrames++;
                const percent = Math.floor((loadedFrames / FRAME_COUNT) * 100);
                loaderBar.style.width = `${percent}%`;
                loaderPercent.textContent = `PREPARANDO EXPERIENCIA... ${percent}%`;

                if (loadedFrames === FRAME_COUNT) {
                    setTimeout(() => {
                        loader.classList.add('hidden');
                        initScrollAnimations();
                    }, 500); // Small delay to let user see 100%
                }
            };
            img.onerror = () => {
                console.error(`Error loading frame ${i}`);
                loadedFrames++; // Keep counting to avoid getting stuck
                if (loadedFrames === FRAME_COUNT) {
                    loader.classList.add('hidden');
                    initScrollAnimations();
                }
            };
            frames.push(img);
        }
    }

    // Start loading
    loadFrames();

    // === 3. Canvas Renderer ===
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    let currentFrame = -1;
    let bgColor = '#1b0108'; // Default deep burgundy background (matches CSS --bg-deep)
    const IMAGE_SCALE = 0.85; // Perfect sweet spot as per skill rules

    function resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        canvas.style.width = `${window.innerWidth}px`;
        canvas.style.height = `${window.innerHeight}px`;
        ctx.scale(dpr, dpr);
        if (currentFrame >= 0) drawFrame(currentFrame);
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    function drawFrame(index) {
        if (!frames[index] || !frames[index].complete) return;

        const cw = window.innerWidth;
        const ch = window.innerHeight;
        const iw = frames[index].naturalWidth;
        const ih = frames[index].naturalHeight;

        // Calculate padded cover dimensions
        const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
        const dw = iw * scale;
        const dh = ih * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;

        // Fill base background to hide borders uniformly
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, cw, ch);

        // Draw the frame
        ctx.drawImage(frames[index], dx, dy, dw, dh);
    }

    // === 4. Core Animations (Initialized after load) ===
    function initScrollAnimations() {
        const scrollContainer = document.getElementById('scroll-container');
        const canvasWrap = document.getElementById('canvas-wrap');
        const heroSection = document.querySelector('.hero-standalone');

        // 4a. Circle-wipe Hero -> Canvas Reveal
        ScrollTrigger.create({
            trigger: scrollContainer,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                const p = self.progress;

                // Hero fades out rapidly as scroll begins
                if (p < 0.1) {
                    heroSection.style.opacity = Math.max(0, 1 - (p * 15));
                    heroSection.style.transform = `translateY(${p * 200}px)`;
                } else {
                    heroSection.style.opacity = 0;
                }

                // Canvas reveals via expanding circle clip-path, staying strictly circular
                const wipeProgress = Math.min(1, Math.max(0, (p - 0.01) / 0.08));
                if (wipeProgress > 0) {
                    // Restrict max radius to ensure it never touches the edges and remains a circle
                    const radius = wipeProgress * 38; // 38vmin keeps it safely within bounds
                    canvasWrap.style.clipPath = `circle(${radius}vmin at 50% 50%)`;
                } else {
                    canvasWrap.style.clipPath = `circle(0% at 50% 50%)`;
                }
            }
        });

        // 4b. Frame-to-Scroll Binding
        const FRAME_SPEED = 1.9; // Fast product completion as per skill rules
        ScrollTrigger.create({
            trigger: scrollContainer,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
                // The video starts playing *after* hero wipe (delay slightly)
                const videoProgress = Math.max(0, (accelerated - 0.05) * 1.05);
                const index = Math.min(Math.floor(videoProgress * FRAME_COUNT), FRAME_COUNT - 1);

                if (index !== currentFrame) {
                    currentFrame = index;
                    requestAnimationFrame(() => drawFrame(currentFrame));
                }
            }
        });

        // Draw first frame immediately to avoid flash when wipe starts
        drawFrame(0);

        // 4c. Dark Overlay Fade
        const overlay = document.getElementById("dark-overlay");
        // Dark overlay needed around enter=75 to leave=88
        const darkEnter = 0.75;
        const darkLeave = 0.88;
        const fadeRange = 0.04;

        ScrollTrigger.create({
            trigger: scrollContainer,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                const p = self.progress;
                let opacity = 0;
                if (p >= darkEnter - fadeRange && p <= darkEnter) {
                    opacity = (p - (darkEnter - fadeRange)) / fadeRange * 0.9;
                } else if (p > darkEnter && p < darkLeave) {
                    opacity = 0.9;
                } else if (p >= darkLeave && p <= darkLeave + fadeRange) {
                    opacity = 0.9 * (1 - (p - darkLeave) / fadeRange);
                }
                overlay.style.opacity = opacity;
            }
        });

        // 4d. Marquee Automation
        const marqueeWrap = document.getElementById('marquee-wrap');
        const marqueeText = marqueeWrap.querySelector('.marquee-text');
        const speed = parseFloat(marqueeWrap.dataset.scrollSpeed) || -25;

        gsap.to(marqueeText, {
            xPercent: speed,
            ease: "none",
            scrollTrigger: {
                trigger: scrollContainer,
                start: "top top",
                end: "bottom bottom",
                scrub: true
            }
        });

        // Fade marquee in/out (Show mainly during ingredients and tensions)
        ScrollTrigger.create({
            trigger: scrollContainer,
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                const p = self.progress;
                // Fade in near 20%, start fading out near 65%
                if (p > 0.15 && p < 0.7) {
                    marqueeWrap.style.opacity = Math.min(1, (p - 0.15) * 10, (0.7 - p) * 10);
                } else {
                    marqueeWrap.style.opacity = 0;
                }
            }
        });

        // 4e. Section Animation System
        const sections = document.querySelectorAll('.scroll-section');
        const scrollHeight = scrollContainer.offsetHeight;

        sections.forEach(section => {
            const enter = parseFloat(section.dataset.enter) / 100;
            const leave = parseFloat(section.dataset.leave) / 100;
            const type = section.dataset.animation;
            const persist = section.dataset.persist === "true";

            // Position section at midpoint of its range
            const midPoint = (enter + leave) / 2;
            section.style.top = `${midPoint * 100}%`;
            section.style.transform = 'translateY(-50%)';

            const children = section.querySelectorAll(".section-label, .section-heading, .section-body, .section-note, .ingredient-card, .stat, .lote-badge, .pricing-card");

            // Setup timeline
            const tl = gsap.timeline({ paused: true });

            switch (type) {
                case "fade-up":
                    tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: "power3.out" });
                    break;
                case "slide-left":
                    tl.from(children, { x: -80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
                    break;
                case "slide-right":
                    tl.from(children, { x: 80, opacity: 0, stagger: 0.14, duration: 0.9, ease: "power3.out" });
                    break;
                case "scale-up":
                    tl.from(children, { scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: "power2.out" });
                    break;
                case "stagger-up":
                    tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: "power3.out" });
                    break;
                case "clip-reveal":
                    tl.from(children, { clipPath: "inset(100% 0 0 0)", opacity: 0, stagger: 0.15, duration: 1.2, ease: "power4.inOut" });
                    break;
                default:
                    tl.from(children, { y: 30, opacity: 0, stagger: 0.1, duration: 0.6 });
            }

            // Trigger animation on scroll range
            let hasPlayed = false;
            ScrollTrigger.create({
                trigger: scrollContainer,
                start: "top top",
                end: "bottom bottom",
                scrub: true,
                onUpdate: (self) => {
                    const p = self.progress;

                    if (persist) {
                        // For persistent sections (like pricing), once we enter the range, it plays and STAYS.
                        if (p >= enter && !hasPlayed) {
                            section.classList.add('visible');
                            tl.play();
                            hasPlayed = true;
                        }
                    } else {
                        // Normal sections (fade in and out)
                        const inRange = p >= enter && p <= leave;
                        if (inRange) {
                            if (!hasPlayed) {
                                section.classList.add('visible');
                                tl.play();
                                hasPlayed = true;
                            }
                        } else if (hasPlayed) {
                            tl.reverse();
                            setTimeout(() => { 
                                if (!tl.isActive() && tl.progress() === 0) {
                                    section.classList.remove('visible'); 
                                }
                            }, 1000);
                            hasPlayed = false;
                        }
                    }
                }
            });
        });

        // 4f. Number Counter Automations
        document.querySelectorAll(".stat-number").forEach(el => {
            const target = parseFloat(el.dataset.value);
            const decimals = parseInt(el.dataset.decimals || "0");
            const parentSection = el.closest(".scroll-section") || scrollContainer;

            // Initial state
            if (target === 0) el.textContent = "100";
            else if (target === 100) el.textContent = "0";
            else el.textContent = "0";

            gsap.to(el, {
                textContent: target,
                duration: 2.5,
                ease: "power2.out",
                snap: { textContent: decimals === 0 ? 1 : 0.01 },
                scrollTrigger: {
                    trigger: parentSection,
                    start: "top 70%", // Triggers when section is 30% from bottom of viewport
                    toggleActions: "play none none reverse"
                }
            });
        });

        // 4g. Make pricing cards hover shine with JS
        document.querySelectorAll('.pricing-card').forEach(card => {
            card.addEventListener('mousemove', e => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(200, 169, 97, 0.12), rgba(200, 169, 97, 0.03) 40%)`;
            });
            card.addEventListener('mouseleave', () => {
                card.style.background = '';
            });
        });

    }
});
