(() => {
  "use strict";

  const KILL_GOAL = 20;
  const PLAYER_SPEED = 180;
  const BULLET_SPEED = 420;
  const ENEMY_BASE_SPEED = 70;
  const FIRE_COOLDOWN = 0.18;
  const SPAWN_INTERVAL_START = 1.4;
  const SPAWN_INTERVAL_MIN = 0.55;

  const screens = {
    title: document.getElementById("title-screen"),
    game: document.getElementById("game-screen"),
    win: document.getElementById("win-screen"),
  };

  const canvas = document.getElementById("game-canvas");
  const ctx = canvas.getContext("2d");
  const killEl = document.getElementById("kill-count");
  const btnPlay = document.getElementById("btn-play");
  const btnAgain = document.getElementById("btn-again");
  const btnHome = document.getElementById("btn-home");
  const btnFire = document.getElementById("btn-fire");
  const dpadBtns = document.querySelectorAll(".dpad-btn");

  const keys = {
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  };

  let running = false;
  let lastTs = 0;
  let spawnTimer = 0;
  let spawnInterval = SPAWN_INTERVAL_START;
  let fireCooldown = 0;
  let kills = 0;
  let facing = { x: 0, y: -1 };
  let player = null;
  let bullets = [];
  let enemies = [];
  let particles = [];
  let worldW = 800;
  let worldH = 600;
  let animId = 0;

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => {
      const on = key === name;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
  }

  function resizeCanvas() {
    const stage = canvas.parentElement;
    const rect = stage.getBoundingClientRect();
    const maxW = Math.max(200, rect.width - 4);
    const maxH = Math.max(160, rect.height - 4);

    // 邏輯座標固定比例，依容器縮放繪製尺寸
    const aspect = 4 / 3;
    let cssW = maxW;
    let cssH = cssW / aspect;
    if (cssH > maxH) {
      cssH = maxH;
      cssW = cssH * aspect;
    }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    worldW = 800;
    worldH = 600;
    canvas.width = Math.floor(worldW * dpr);
    canvas.height = Math.floor(worldH * dpr);
    canvas.style.width = `${Math.floor(cssW)}px`;
    canvas.style.height = `${Math.floor(cssH)}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function resetGame() {
    kills = 0;
    killEl.textContent = "0";
    spawnTimer = 0.6;
    spawnInterval = SPAWN_INTERVAL_START;
    fireCooldown = 0;
    facing = { x: 0, y: -1 };
    bullets = [];
    enemies = [];
    particles = [];
    player = {
      x: worldW / 2,
      y: worldH - 48,
      r: 14,
      hp: 1,
    };
  }

  function startGame() {
    showScreen("game");
    resizeCanvas();
    resetGame();
    running = true;
    lastTs = performance.now();
    cancelAnimationFrame(animId);
    animId = requestAnimationFrame(loop);
  }

  function endLevel() {
    running = false;
    cancelAnimationFrame(animId);
    showScreen("win");
  }

  function goHome() {
    running = false;
    cancelAnimationFrame(animId);
    showScreen("title");
  }

  function normalize(x, y) {
    const len = Math.hypot(x, y);
    if (len < 0.0001) return { x: 0, y: -1 };
    return { x: x / len, y: y / len };
  }

  function shoot(dirX, dirY) {
    if (!player || fireCooldown > 0) return;
    const dir = normalize(dirX, dirY);
    facing = dir;
    fireCooldown = FIRE_COOLDOWN;
    bullets.push({
      x: player.x + dir.x * 18,
      y: player.y + dir.y * 18,
      vx: dir.x * BULLET_SPEED,
      vy: dir.y * BULLET_SPEED,
      r: 3.5,
      life: 1.6,
    });
  }

  function shootFacing() {
    shoot(facing.x, facing.y);
  }

  function spawnEnemy() {
    const edge = Math.floor(Math.random() * 3); // 上、左、右（不從下方刷）
    let x;
    let y;
    if (edge === 0) {
      x = Math.random() * worldW;
      y = -20;
    } else if (edge === 1) {
      x = -20;
      y = Math.random() * worldH * 0.7;
    } else {
      x = worldW + 20;
      y = Math.random() * worldH * 0.7;
    }
    const speed = ENEMY_BASE_SPEED + Math.random() * 40 + kills * 2;
    enemies.push({
      x,
      y,
      r: 13,
      speed,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + Math.random() * 0.25,
        color,
      });
    }
  }

  function update(dt) {
    if (!player) return;

    let mx = 0;
    let my = 0;
    if (keys.left) mx -= 1;
    if (keys.right) mx += 1;
    if (keys.up) my -= 1;
    if (keys.down) my += 1;

    if (mx !== 0 || my !== 0) {
      const dir = normalize(mx, my);
      facing = dir;
      player.x += dir.x * PLAYER_SPEED * dt;
      player.y += dir.y * PLAYER_SPEED * dt;
      player.x = Math.max(player.r, Math.min(worldW - player.r, player.x));
      player.y = Math.max(player.r, Math.min(worldH - player.r, player.y));
    }

    fireCooldown = Math.max(0, fireCooldown - dt);
    if (keys.fire) shootFacing();

    spawnTimer -= dt;
    if (spawnTimer <= 0 && kills < KILL_GOAL) {
      spawnEnemy();
      spawnInterval = Math.max(SPAWN_INTERVAL_MIN, spawnInterval - 0.04);
      spawnTimer = spawnInterval;
    }

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < -20 ||
        b.x > worldW + 20 ||
        b.y < -20 ||
        b.y > worldH + 20
      ) {
        bullets.splice(i, 1);
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      const dir = normalize(player.x - e.x, player.y - e.y);
      e.wobble += dt * 4;
      e.x += (dir.x * e.speed + Math.cos(e.wobble) * 12) * dt;
      e.y += (dir.y * e.speed + Math.sin(e.wobble) * 8) * dt;

      // 敵人碰到玩家：輕推開（本關無血量失敗條件）
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < e.r + player.r) {
        const push = normalize(dx, dy);
        e.x = player.x + push.x * (e.r + player.r + 1);
        e.y = player.y + push.y * (e.r + player.r + 1);
      }
    }

    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      let hit = false;
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) {
          bullets.splice(j, 1);
          hit = true;
          break;
        }
      }
      if (hit) {
        burst(e.x, e.y, "#ff5252");
        enemies.splice(i, 1);
        kills += 1;
        killEl.textContent = String(kills);
        if (kills >= KILL_GOAL) {
          endLevel();
          return;
        }
      }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawTerrain() {
    ctx.fillStyle = "#24301c";
    ctx.fillRect(0, 0, worldW, worldH);

    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = "#6b8f3c";
    ctx.lineWidth = 1;
    for (let x = 0; x < worldW; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, worldH);
      ctx.stroke();
    }
    for (let y = 0; y < worldH; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(worldW, y);
      ctx.stroke();
    }
    ctx.restore();

    // 地平線迷霧
    const g = ctx.createLinearGradient(0, 0, 0, 80);
    g.addColorStop(0, "rgba(10, 16, 10, 0.55)");
    g.addColorStop(1, "rgba(10, 16, 10, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, worldW, 80);
  }

  function drawPlayer() {
    if (!player) return;
    const { x, y } = player;
    const ang = Math.atan2(facing.y, facing.x);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + Math.PI / 2);

    // 身體
    ctx.fillStyle = "#4d6230";
    ctx.beginPath();
    ctx.roundRect(-10, -8, 20, 24, 4);
    ctx.fill();

    // 頭盔
    ctx.fillStyle = "#3a4a24";
    ctx.beginPath();
    ctx.arc(0, -12, 9, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(-9, -14, 18, 6);

    // 臉
    ctx.fillStyle = "#c4a882";
    ctx.beginPath();
    ctx.arc(0, -9, 5, 0, Math.PI * 2);
    ctx.fill();

    // 槍
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(-2, -28, 4, 18);
    ctx.fillRect(-3, -30, 6, 4);

    ctx.restore();

    // 腳底陰影
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(x, y + 14, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawEnemy(e) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(0, 12, 10, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#c62828";
    ctx.beginPath();
    ctx.roundRect(-9, -8, 18, 20, 3);
    ctx.fill();

    ctx.fillStyle = "#8b0000";
    ctx.beginPath();
    ctx.arc(0, -12, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff8a80";
    ctx.beginPath();
    ctx.arc(-3, -12, 1.5, 0, Math.PI * 2);
    ctx.arc(3, -12, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function draw() {
    drawTerrain();

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    for (const b of bullets) {
      ctx.fillStyle = "#ffe082";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffb300";
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    for (const e of enemies) drawEnemy(e);
    drawPlayer();
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    update(dt);
    if (!running) {
      draw();
      return;
    }
    draw();
    animId = requestAnimationFrame(loop);
  }

  function canvasToWorld(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * worldW;
    const y = ((clientY - rect.top) / rect.height) * worldH;
    return { x, y };
  }

  function onCanvasPointer(clientX, clientY) {
    if (!running || !player) return;
    const pos = canvasToWorld(clientX, clientY);
    shoot(pos.x - player.x, pos.y - player.y);
  }

  // —— 事件 ——
  btnPlay.addEventListener("click", startGame);
  btnAgain.addEventListener("click", startGame);
  btnHome.addEventListener("click", goHome);

  dpadBtns.forEach((btn) => {
    const dir = btn.dataset.dir;
    const on = (e) => {
      e.preventDefault();
      keys[dir] = true;
      btn.classList.add("pressed");
    };
    const off = (e) => {
      e.preventDefault();
      keys[dir] = false;
      btn.classList.remove("pressed");
    };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  });

  const fireOn = (e) => {
    e.preventDefault();
    keys.fire = true;
    btnFire.classList.add("pressed");
    shootFacing();
  };
  const fireOff = (e) => {
    e.preventDefault();
    keys.fire = false;
    btnFire.classList.remove("pressed");
  };
  btnFire.addEventListener("pointerdown", fireOn);
  btnFire.addEventListener("pointerup", fireOff);
  btnFire.addEventListener("pointerleave", fireOff);
  btnFire.addEventListener("pointercancel", fireOff);

  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    onCanvasPointer(e.clientX, e.clientY);
  });

  const keyMap = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    KeyW: "up",
    KeyS: "down",
    KeyA: "left",
    KeyD: "right",
  };

  window.addEventListener("keydown", (e) => {
    if (keyMap[e.code]) {
      e.preventDefault();
      keys[keyMap[e.code]] = true;
    }
    if (e.code === "Space") {
      e.preventDefault();
      keys.fire = true;
      shootFacing();
    }
  });

  window.addEventListener("keyup", (e) => {
    if (keyMap[e.code]) {
      e.preventDefault();
      keys[keyMap[e.code]] = false;
    }
    if (e.code === "Space") {
      e.preventDefault();
      keys.fire = false;
    }
  });

  window.addEventListener("resize", () => {
    if (screens.game.classList.contains("active")) resizeCanvas();
  });
  window.addEventListener("orientationchange", () => {
    setTimeout(() => {
      if (screens.game.classList.contains("active")) resizeCanvas();
    }, 120);
  });

  // roundRect polyfill for older browsers
  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      const radius = typeof r === "number" ? r : 0;
      this.moveTo(x + radius, y);
      this.arcTo(x + w, y, x + w, y + h, radius);
      this.arcTo(x + w, y + h, x, y + h, radius);
      this.arcTo(x, y + h, x, y, radius);
      this.arcTo(x, y, x + w, y, radius);
      this.closePath();
      return this;
    };
  }

  showScreen("title");
})();
