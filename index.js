const { Telegraf, Markup } = require("telegraf");
const fetch = require("node-fetch");
const fs = require("fs");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.API_KEY;
const bot = new Telegraf(BOT_TOKEN);

const TIMEZONE = "Europe/Istanbul";

// Gelen date_unix'i ekrana formatlı yaz
function formatDateTime(unix) {
  const date = new Date(unix * 1000);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const hour = date.getHours().toString().padStart(2, "0");
  const minute = date.getMinutes().toString().padStart(2, "0");
  return `${day}.${month} - ${hour}:${minute}`;
}

// /canli → Başlamış ama tamamlanmamış maçlar
bot.command("canli", async (ctx) => {
  try {
    const response = await fetch(`https://api.football-data-api.com/todays-matches?key=${API_KEY}&timezone=${TIMEZONE}`);
    const data = await response.json();
    const now = Math.floor(Date.now() / 1000);

    const liveMatches = data.data.filter((match) => {
      const matchTime = match.date_unix;
      const elapsedMinutes = (now - matchTime) / 60;
      return matchTime <= now && elapsedMinutes < 180 && match.status !== "complete";
    });

    if (liveMatches.length === 0) {
      return ctx.reply("📭 Şu anda canlı maç yok.");
    }

    const buttons = liveMatches.map((match) => {
      const home = match.home_name || "Ev";
      const away = match.away_name || "Dep";
      const homeScore = match.homeGoalCount ?? "-";
      const awayScore = match.awayGoalCount ?? "-";
      const elapsed = Math.floor((now - match.date_unix) / 60);
      const title = `${home} ${homeScore} - ${awayScore} ${away} | ${elapsed}' (${formatDateTime(match.date_unix)})`;
      return Markup.button.callback(title, `match_${match.id}`);
    });

    ctx.reply("📺 Canlı Maçlar:", Markup.inlineKeyboard(buttons, { columns: 1 }));
  } catch (err) {
    console.error("CANLI HATA:", err);
    ctx.reply("Canlı maçlar alınamadı.");
  }
});

// /tum → Bugünkü tüm bitmemiş maçlar
bot.command("tum", async (ctx) => {
  try {
    const response = await fetch(`https://api.football-data-api.com/todays-matches?key=${API_KEY}&timezone=${TIMEZONE}`);
    const data = await response.json();
    const filtered = data.data.filter((match) => match.status !== "complete");

    if (filtered.length === 0) {
      return ctx.reply("Bugün için başka maç kalmadı.");
    }

    const buttons = filtered.map((match) => {
      const home = match.home_name || "Ev";
      const away = match.away_name || "Dep";
      const title = `${home} vs ${away} | ${formatDateTime(match.date_unix)}`;
      return Markup.button.callback(title, `match_${match.id}`);
    });

    ctx.reply("📅 Bugünkü Maçlar:", Markup.inlineKeyboard(buttons, { columns: 1 }));
  } catch (err) {
    console.error("TUM HATA:", err);
    ctx.reply("Tüm maçlar alınamadı.");
  }
});

// Butona tıklanınca JSON detay gönder
bot.on("callback_query", async (ctx) => {
  const match = ctx.update.callback_query.data;
  if (!match.startsWith("match_")) return ctx.answerCbQuery();

  const matchId = match.split("_")[1];
  const url = `https://api.football-data-api.com/match?key=${API_KEY}&match_id=${matchId}&timezone=${TIMEZONE}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const data = json.data;

    if (!data) return ctx.reply("Detay alınamadı.");

    const home = data.home_name || "Ev_Sahibi";
    const away = data.away_name || "Deplasman";
    const homeScore = data.homeGoalCount ?? "-";
    const awayScore = data.awayGoalCount ?? "-";

    const fileDate = formatDateTime(data.date_unix).replace(/[:\s]/g, "-");
    const safeHome = home.replace(/\s+/g, "_");
    const safeAway = away.replace(/\s+/g, "_");
    const filename = `${safeHome}_vs_${safeAway}_${fileDate}.json`;

    const enriched = {
      match_title: `${home} vs ${away}`,
      match_date: formatDateTime(data.date_unix),
      ...json,
    };

    fs.writeFileSync(filename, JSON.stringify(enriched, null, 2));
    await ctx.reply(`${home} ${homeScore} - ${awayScore} ${away}`);
    await ctx.replyWithDocument({ source: filename });
    fs.unlinkSync(filename);
  } catch (err) {
    console.error("DETAY HATA:", err);
    ctx.reply("Maç detayı alınamadı.");
  }

  ctx.answerCbQuery();
});

// Botu başlat
bot.launch();
console.log("✅ Bot çalışıyor (timezone = Europe/Istanbul)");