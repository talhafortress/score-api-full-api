const { Telegraf, Markup } = require("telegraf");
const fetch = require("node-fetch");
const fs = require("fs");
require("dotenv").config(); 

const BOT_TOKEN = process.env.BOT_TOKEN;
const API_KEY = process.env.API_KEY;
const bot = new Telegraf(BOT_TOKEN);

bot.command("canli", async (ctx) => {
  try {
    const response = await fetch(`https://api.football-data-api.com/todays-matches?key=${API_KEY}`);
    const data = await response.json();
    const now = Math.floor(Date.now() / 1000);

    const liveMatches = data.data.filter((match) => {
      const matchTime = match.date_unix;
      const elapsedMinutes = (now - matchTime) / 60;
      return matchTime <= now && elapsedMinutes < 120;
    });

    if (liveMatches.length === 0) {
      return ctx.reply("Şu anda canlı maç yok.");
    }

    const buttons = liveMatches.map((match) => {
      const home = match.home_name || "Ev Sahibi";
      const away = match.away_name || "Deplasman";
      const homeScore = match.homeGoalCount ?? "-";
      const awayScore = match.awayGoalCount ?? "-";

      const matchDate = new Date(match.date_unix * 1000);
      const day = matchDate.getDate().toString().padStart(2, "0");
      const month = (matchDate.getMonth() + 1).toString().padStart(2, "0");
      const dateStr = `${day}.${month}`;

      const elapsed = Math.floor((now - match.date_unix) / 60);
      const minuteText = elapsed >= 120 ? "Bitmiş" : `${elapsed}'`;

      const title = `${home} ${homeScore} - ${awayScore} ${away} | ${minuteText} (${dateStr})`;
      return Markup.button.callback(title, `match_${match.id}`);
    });

    ctx.reply("📺 Canlı Maçlar:", Markup.inlineKeyboard(buttons, { columns: 1 }));
  } catch (err) {
    console.error(err);
    ctx.reply("Bir hata oluştu.");
  }
});


bot.command("tum", async (ctx) => {
  try {
    const response = await fetch(`https://api.football-data-api.com/todays-matches?key=${API_KEY}`);
    const data = await response.json();
    const now = Math.floor(Date.now() / 1000);

    const upcomingMatches = data.data.filter((match) => match.date_unix > now);

    if (upcomingMatches.length === 0) {
      return ctx.reply("Bugün için kalan maç yok.");
    }

    const buttons = upcomingMatches.map((match) => {
      const home = match.home_name || "Ev Sahibi";
      const away = match.away_name || "Deplasman";

      const matchDate = new Date(match.date_unix * 1000);
      const day = matchDate.getDate().toString().padStart(2, "0");
      const month = (matchDate.getMonth() + 1).toString().padStart(2, "0");
      const hour = matchDate.getHours().toString().padStart(2, "0");
      const minute = matchDate.getMinutes().toString().padStart(2, "0");

      const dateStr = `${day}.${month}`;
      const timeStr = `${hour}:${minute}`;

      const title = `${home} vs ${away} | ${dateStr} - ${timeStr}`;
      return Markup.button.callback(title, `match_${match.id}`);
    });

    ctx.reply("⏳ Başlamamış Maçlar:", Markup.inlineKeyboard(buttons, { columns: 1 }));
  } catch (err) {
    console.error(err);
    ctx.reply("Bir hata oluştu.");
  }
});



// 2. Callback Query (Butona Tıklanınca)
bot.on("callback_query", async (ctx) => {
  const match = ctx.update.callback_query.data;

  if (match.startsWith("match_")) {
    const matchId = match.split("_")[1];
    const url = `https://api.football-data-api.com/match?key=${API_KEY}&match_id=${matchId}`;

    try {
      const response = await fetch(url);
      const matchDetails = await response.json();
      const data = matchDetails.data; // <- HATA BURADAYDI: data tanımlanmalıydı

      if (!data) {
        return ctx.reply("Maç bilgisi bulunamadı.");
      }

      // Takım adları ve skor
      const homeName = data.home_name || "Ev_Sahibi";
      const awayName = data.away_name || "Deplasman";
      const homeScore = data.homeGoalCount ?? "-";
      const awayScore = data.awayGoalCount ?? "-";

      // Tarih formatlama
      const matchDate = new Date(data.date_unix * 1000);
      const day = matchDate.getDate().toString().padStart(2, "0");
      const month = (matchDate.getMonth() + 1).toString().padStart(2, "0");
      const year = matchDate.getFullYear();
      const formattedDate = `${day}.${month}.${year}`;

      // Dosya ismini güvenli hale getir
      const safeHome = homeName.replace(/\s+/g, "_");
      const safeAway = awayName.replace(/\s+/g, "_");
      const filename = `${safeHome}_vs_${safeAway}_${formattedDate}.json`;

      // JSON içeriğine başlık ve tarih ekle
      const enrichedData = {
        match_title: `${homeName} vs ${awayName}`,
        match_date: formattedDate,
        ...matchDetails,
      };

      // JSON dosyasını oluştur
      fs.writeFileSync(filename, JSON.stringify(enrichedData, null, 2));

      // Kullanıcıya gönder
      await ctx.reply(`${homeName} ${homeScore} - ${awayScore} ${awayName}`);
      await ctx.replyWithDocument({ source: filename });

      // Dosyayı temizle
      fs.unlinkSync(filename);
    } catch (err) {
      console.error("Hata:", err);
      ctx.reply("Maç detayları alınamadı.");
    }
  }

  ctx.answerCbQuery(); // Buton animasyonunu kapat
});

// Botu başlat
bot.launch();
console.log("Bot çalışıyor...");
