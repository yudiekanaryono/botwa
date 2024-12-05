const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const express = require("express");
const path = require("path");
const multer = require("multer");
const fs = require("fs");
const schedule = require("node-schedule"); // Tambahkan node-schedule
const app = express();
const port = 3000;

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

const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("WhatsApp sudah siap!");
});

client.on("message", (message) => {
  console.log(message.body);
});

client.initialize();

// Fungsi untuk mengirim pesan
const sendWhatsAppMessage = (sendTo, message, filePath) => {
  if (filePath) {
    const media = MessageMedia.fromFilePath(filePath);
    client
      .sendMessage(sendTo, media, { caption: message })
      .then(() => {
        fs.unlinkSync(filePath); // Menghapus file setelah dikirim
        console.log(`Pesan dan file berhasil dikirim ke ${sendTo}`);
      })
      .catch((error) => {
        console.error(
          `Terjadi kesalahan saat mengirim file ke ${sendTo}:`,
          error
        );
      });
  } else {
    client
      .sendMessage(sendTo, message)
      .then(() => {
        console.log(`Pesan berhasil dikirim ke ${sendTo}`);
      })
      .catch((error) => {
        console.error(
          `Terjadi kesalahan saat mengirim pesan ke ${sendTo}:`,
          error
        );
      });
  }
};

// API endpoint untuk mengirim pesan dan file ke nomor atau grup
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
        .send("Waktu jadwal tidak valid. Harap pilih waktu di masa depan.");
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
    res.send("Pesan berhasil dikirim ke semua penerima!");
  }
});

// Melayani halaman HTML pada path root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Membuat direktori uploads jika belum ada
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
