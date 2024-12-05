const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const schedule = require("node-schedule");
const app = express();
const port = 3000;

// Middleware untuk menangani body request
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup penyimpanan untuk multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

// Inisialisasi client WhatsApp
const client = new Client({
  authStrategy: new LocalAuth(),
});

// Tampilkan QR code untuk login
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

// Pesan saat WhatsApp siap digunakan
client.on("ready", () => {
  console.log("WhatsApp sudah siap!");
});

// Jam kerja bot (contoh: pukul 08:00 hingga 17:00)
const workHoursStart = 2; // Jam mulai (24 jam format)
const workHoursEnd = 8; // Jam selesai (24 jam format)

// Event untuk menangani pesan otomatis
client.on("message", (message) => {
  // Abaikan pesan dari status WhatsApp
  if (message.from === "status@broadcast") {
    // Tidak tampilkan pesan dari status WhatsApp
    return;
  }

  // Abaikan pesan dari grup
  if (message.from.endsWith("@g.us")) {
    // Tidak tampilkan pesan dari grup
    return;
  }

  const senderName = message.notifyName || message.from; // Gunakan `notifyName` jika tersedia, jika tidak fallback ke nomor pengirim

  // Tampilkan pesan dari pengirim yang valid
  console.log(
    `Pesan diterima dari ${senderName} (${message.from}): ${message.body}`
  );

  // Cek waktu saat pesan diterima
  const now = new Date();
  const currentHour = now.getHours();

  // Jika di luar jam kerja, balas pesan otomatis
  if (currentHour < workHoursStart || currentHour >= workHoursEnd) {
    message.reply(
      `BOT :⏰ Maaf, belum waktunya saya bekerja. Saya bekerja dari jam ${workHoursStart}:00 sampai ${workHoursEnd}:00, Terimakasih.`
    );
    return;
  }

  // Jawaban otomatis berdasarkan isi pesan
  if (message.body.toLowerCase() === "halo") {
    message.reply("👋 Halo! Ada yang bisa saya bantu?");
  } else if (message.body.toLowerCase() === "info") {
    message.reply(
      "📋 Ini adalah bot WhatsApp. Ketik 'help' untuk bantuan lebih lanjut."
    );
  } else if (message.body.toLowerCase() === "help") {
    message.reply(
      "🔧 Bot ini dapat:\n1️⃣ Mengirim pesan otomatis.\n2️⃣ Menjadwalkan pesan.\n3️⃣ Menjawab otomatis dalam jam kerja."
    );
  } else if (message.body.toLowerCase() === "fak") {
    message.reply("Enggak boleh gtu sayang");
  }
});

// Fungsi untuk mengirim pesan
const sendWhatsAppMessage = (sendTo, message, filePath) => {
  if (filePath) {
    const media = MessageMedia.fromFilePath(filePath);
    client
      .sendMessage(sendTo, media, { caption: message })
      .then(() => {
        fs.unlinkSync(filePath); // Hapus file setelah pengiriman
        console.log(`Pesan dan file berhasil dikirim ke ${sendTo}`);
      })
      .catch((error) => {
        console.error(`Terjadi kesalahan saat mengirim ke ${sendTo}:`, error);
      });
  } else {
    client
      .sendMessage(sendTo, message)
      .then(() => {
        console.log(`Pesan berhasil dikirim ke ${sendTo}`);
      })
      .catch((error) => {
        console.error(`Terjadi kesalahan saat mengirim ke ${sendTo}:`, error);
      });
  }
};

// API untuk mengirim pesan dan file ke nomor
app.post("/send-message", upload.single("file"), (req, res) => {
  const { numbers, groups, message, schedule: scheduleTime } = req.body;

  if (!numbers && !groups) {
    return res.status(400).send("Harap beri nomor atau ID grup");
  }

  const numberList = numbers ? numbers.split(",").map((n) => n.trim()) : [];
  const groupList = groups ? groups.split(",").map((g) => g.trim()) : [];
  const recipients = [
    ...numberList.map((n) => `${n}@c.us`),
    ...groupList.map((g) => `${g}@g.us`),
  ];

  const filePath = req.file
    ? path.join(__dirname, "uploads", req.file.filename)
    : null;

  if (scheduleTime) {
    const sendDate = new Date(scheduleTime);
    if (sendDate < new Date()) {
      return res
        .status(400)
        .send("Waktu jadwal tidak valid. Pilih waktu di masa depan.");
    }

    schedule.scheduleJob(sendDate, () => {
      recipients.forEach((recipient) =>
        sendWhatsAppMessage(recipient, message, filePath)
      );
    });

    res.send("Pesan berhasil dijadwalkan!");
  } else {
    recipients.forEach((recipient) =>
      sendWhatsAppMessage(recipient, message, filePath)
    );
    res.send("Pesan berhasil dikirim!");
  }
});

// Melayani halaman HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Membuat direktori uploads jika belum ada
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

// Menjalankan server
app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});

client.on("call", (call) => {
  const now = new Date();
  const currentHour = now.getHours();
  if (currentHour < workHoursStart || currentHour >= workHoursEnd) {
    call.reject(); // Menolak panggilan otomatis di luar jam kerja
    console.log(
      `Panggilan dari ${call.peer} ditolak karena di luar jam kerja.`
    );
  }
});

client.initialize();
