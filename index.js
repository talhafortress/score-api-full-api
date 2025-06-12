const { Telegraf, Markup } = require("telegraf");
const fetch = require("node-fetch");
const fs = require("fs");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.API_KEY;
const bot = new Telegraf(BOT_TOKEN);

// Türkiye saatini formatlayan fonksiyon
function formatLocalDateTime(unix) {
  return new Date(unix * 1000).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });
}

// 🔴 /canli — Maç zamanı geçmiş ama bitmemiş olanlar (yaklaşık 180 dakikaya kadar)
bot.command("canli", async (ctx) => {
  try {
    const response = await fetch(`https://api.football-data-api.com/todays-matches?key=${API_KEY}&timezone=Europe/Istanbul`);
    const data = await response.json();
    const now = Math.floor(Date.now() / 1000);

    const liveMatches = data.data.filter(match => {
      const matchTime = match.date_unix;
      const elapsedMinutes = (now - matchTime) / 60;
      return matchTime <= now && elapsedMinutes < 180;
    });

    if (liveMatches.length === 0) {
      return ctx.reply("📭 Şu anda canlı bir maç görünmüyor.");
    }

    const buttons = liveMatches.map(match => {
      const home = match.home_name || "Ev Sahibi";
      const away = match.away_name || "Deplasman";
      const homeScore = match.homeGoalCount ?? "-";
      const awayScore = match.awayGoalCount ?? "-";

      const elapsed = Math.floor((now - match.date_unix) / 60);
      const minuteText = elapsed >= 120 ? "Bitmiş" : `${elapsed}'`;
      const localTime = formatLocalDateTime(match.date_unix);

      const title = `${home} ${homeScore} - ${awayScore} ${away} | ${minuteText} (${localTime})`;
      return Markup.button.callback(title, `match_${match.id}`);
    });

    ctx.reply("📺 Canlı Maçlar:", Markup.inlineKeyboard(buttons, { columns: 1 }));
  } catch (err) {
    console.error("CANLI MAÇ HATASI:", err);
    ctx.reply("Bir hata oluştu, canlı maçlar çekilemedi.");
  }
});

// 🟡 /tum — Sadece başlamamış maçlar (bugün + ileri saat)
bot.command("tum", async (ctx) => {
  try {
    const response = await fetch(`https://api.football-data-api.com/todays-matches?key=${API_KEY}&timezone=Europe/Istanbul`);
    const data = await response.json();
    const now = Math.floor(Date.now() / 1000);

    const upcoming = data.data.filter(match => match.date_unix > now);

    if (upcoming.length === 0) {
      return ctx.reply("⛔ Bugün için kalan başlamamış maç yok.");
    }

    const buttons = upcoming.map(match => {
      const home = match.home_name || "Ev Sahibi";
      const away = match.away_name || "Deplasman";
      const localTime = formatLocalDateTime(match.date_unix);
      const title = `${home} vs ${away} | ${localTime}`;
      return Markup.button.callback(title, `match_${match.id}`);
    });

    ctx.reply("⏳ Başlamamış Maçlar:", Markup.inlineKeyboard(buttons, { columns: 1 }));
  } catch (err) {
    console.error("TUM HATASI:", err);
    ctx.reply("Bir hata oluştu, maçlar çekilemedi.");
  }
});

// 📄 Butona tıklanınca maç detaylarını JSON dosyası olarak gönder
bot.on("callback_query", async (ctx) => {
  const match = ctx.update.callback_query.data;
  if (!match.startsWith("match_")) return ctx.answerCbQuery();

  const matchId = match.split("_")[1];
  const url = `https://api.football-data-api.com/match?key=${API_KEY}&match_id=${matchId}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    const data = json.data;

    if (!data) return ctx.reply("Maç bilgisi alınamadı.");

    const home = data.home_name || "Ev_Sahibi";
    const away = data.away_name || "Deplasman";
    const homeScore = data.homeGoalCount ?? "-";
    const awayScore = data.awayGoalCount ?? "-";

    const localDate = formatLocalDateTime(data.date_unix).replaceAll(":", "-").replaceAll(" ", "_");
    const safeHome = home.replace(/\s+/g, "_");
    const safeAway = away.replace(/\s+/g, "_");
    const filename = `${safeHome}_vs_${safeAway}_${localDate}.json`;

    const enriched = {
      match_title: `${home} vs ${away}`,
      match_date_local: formatLocalDateTime(data.date_unix),
      ...json,
    };

    fs.writeFileSync(filename, JSON.stringify(enriched, null, 2));
    await ctx.reply(`${home} ${homeScore} - ${awayScore} ${away}`);
    await ctx.replyWithDocument({ source: filename });
    fs.unlinkSync(filename);
  } catch (err) {
    console.error("DETAY HATASI:", err);
    ctx.reply("Maç detayları alınamadı.");
  }

  ctx.answerCbQuery();
});

// 🔄 Botu çalıştır
bot.launch();
console.log("✅ Bot çalışıyor...");