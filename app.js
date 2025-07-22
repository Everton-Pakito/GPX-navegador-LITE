if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

let map = L.map('map').setView([-22.2171, -48.7173], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

const gpxFiles = [];

document.getElementById('gpxInput').addEventListener('change', (event) => {
  const files = Array.from(event.target.files);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      gpxFiles.push({ name: file.name, content: e.target.result });
      updateGPXList();
    };
    reader.onerror = () => {
      alert('Erro ao ler o arquivo: ' + file.name);
    };
    reader.readAsText(file);
  });
});

function updateGPXList() {
  const list = document.getElementById('gpxList');
  list.innerHTML = '';
  gpxFiles.forEach((file, index) => {
    const item = document.createElement('li');
    item.className = 'list-item';
    item.innerHTML = `
      <span>${file.name}</span>
      <button class="btn" onclick="loadGPX(${index})">Selecionar</button>
    `;
    list.appendChild(item);
  });
}

// Tornar a função global
window.loadGPX = function(index) {
  const gpxContent = gpxFiles[index].content;
  if (window.gpxLayer) map.removeLayer(window.gpxLayer);

  window.gpxLayer = new L.GPX(gpxContent, {
    async: true
  }).on('loaded', function(e) {
    map.fitBounds(e.target.getBounds());
    speak('Rota carregada com sucesso.');

    // Tentar entrar em tela cheia
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }).addTo(map);
};

function speak(message) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'pt-BR';
  utterance.voice = synth.getVoices().find(v => v.lang === 'pt-BR' && v.name.includes('Female')) || null;
  synth.speak(utterance);
}
