// Service Worker Registration
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('service-worker.js');
}

// Função para carregar Leaflet como fallback
function loadLeafletFallback() {
  if (typeof L !== 'undefined') return Promise.resolve();
  
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => {
      console.log('Leaflet carregado via fallback');
      resolve();
    };
    script.onerror = () => {
      console.error('Erro ao carregar Leaflet via fallback');
      reject(new Error('Não foi possível carregar o Leaflet'));
    };
    document.head.appendChild(script);
  });
}

// Variáveis globais
let map;
let currentGpxLayer = null;
const gpxFiles = [];

// Função para inicializar quando o Leaflet estiver pronto
async function initializeApp() {
  try {
    // Tentar carregar Leaflet se não estiver disponível
    if (typeof L === 'undefined') {
      console.log('Leaflet não encontrado, tentando carregar...');
      await loadLeafletFallback();
    }

    if (typeof L === 'undefined') {
      throw new Error('Não foi possível carregar a biblioteca Leaflet');
    }

    // Inicializar o mapa
    map = L.map('map').setView([-22.2171, -48.7173], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);
    
    console.log('Mapa inicializado com sucesso');
    showMessage('App carregado com sucesso!', 'success');
    
  } catch (error) {
    console.error('Erro ao inicializar o mapa:', error);
    document.getElementById('messages').innerHTML = '<div class="error-message">Erro ao inicializar: ' + error.message + '. Tente recarregar a página.</div>';
  }
}

// Aguardar o carregamento completo da página
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(initializeApp, 500);
  });
} else {
  setTimeout(initializeApp, 500);
}

// Event listener para upload de arquivos
document.addEventListener('DOMContentLoaded', function() {
  const gpxInput = document.getElementById('gpxInput');
  if (gpxInput) {
    gpxInput.addEventListener('change', handleFileSelect);
    
    // Limpar input após seleção
    gpxInput.addEventListener('change', function() {
      setTimeout(() => {
        this.value = '';
      }, 1000);
    });
  }
});

function handleFileSelect(event) {
  const files = Array.from(event.target.files);
  const messages = document.getElementById('messages');
  messages.innerHTML = '';

  if (files.length === 0) return;

  files.forEach(file => {
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      showMessage('Apenas arquivos .gpx são aceitos: ' + file.name, 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const content = e.target.result;
        
        // Verificar se é um XML válido
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(content, 'text/xml');
        
        if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
          throw new Error('XML inválido');
        }

        // Verificar se contém elementos GPX
        if (!xmlDoc.getElementsByTagName('gpx').length && 
            !xmlDoc.getElementsByTagName('trk').length && 
            !xmlDoc.getElementsByTagName('wpt').length) {
          throw new Error('Arquivo não contém dados GPX válidos');
        }

        gpxFiles.push({ 
          name: file.name, 
          content: content,
          id: Date.now() + Math.random()
        });
        
        updateGPXList();
        showMessage('Arquivo carregado: ' + file.name, 'success');
      } catch (error) {
        console.error('Erro ao processar arquivo:', error);
        showMessage('Erro ao processar arquivo ' + file.name + ': ' + error.message, 'error');
      }
    };

    reader.onerror = function() {
      showMessage('Erro ao ler arquivo: ' + file.name, 'error');
    };

    reader.readAsText(file);
  });
}

function updateGPXList() {
  const list = document.getElementById('gpxList');
  list.innerHTML = '';
  
  if (gpxFiles.length === 0) {
    list.innerHTML = '<li class="empty-state">Nenhum arquivo GPX carregado ainda</li>';
    return;
  }

  gpxFiles.forEach((file, index) => {
    const item = document.createElement('li');
    item.className = 'list-item';
    item.innerHTML = `
      <span>${file.name}</span>
      <div>
        <button class="btn" onclick="loadGPX(${index})">Selecionar</button>
        <button class="btn" onclick="removeGPX(${index})" style="background: #e74c3c; margin-left: 5px;">Remover</button>
      </div>
    `;
    list.appendChild(item);
  });
}

// Função global para carregar GPX
window.loadGPX = function(index) {
  if (typeof L === 'undefined') {
    showMessage('Erro: Biblioteca de mapas não carregada. Recarregue a página.', 'error');
    return;
  }

  if (!map) {
    showMessage('Erro: Mapa não inicializado. Recarregue a página.', 'error');
    return;
  }

  if (!gpxFiles[index]) {
    showMessage('Arquivo não encontrado', 'error');
    return;
  }

  try {
    const gpxContent = gpxFiles[index].content;
    
    // Remover camada anterior se existir
    if (currentGpxLayer) {
      map.removeLayer(currentGpxLayer);
    }

    // Parser simples de GPX
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    const trackPoints = xmlDoc.getElementsByTagName('trkpt');
    const wayPoints = xmlDoc.getElementsByTagName('wpt');
    
    if (trackPoints.length === 0 && wayPoints.length === 0) {
      showMessage('Nenhum ponto de trilha ou waypoint encontrado no arquivo', 'error');
      return;
    }

    // Criar grupo de camadas
    currentGpxLayer = L.layerGroup();
    const latlngs = [];

    // Processar pontos de trilha
    for (let i = 0; i < trackPoints.length; i++) {
      const lat = parseFloat(trackPoints[i].getAttribute('lat'));
      const lon = parseFloat(trackPoints[i].getAttribute('lon'));
      if (!isNaN(lat) && !isNaN(lon)) {
        latlngs.push([lat, lon]);
      }
    }

    // Criar linha da trilha se houver pontos
    if (latlngs.length > 1) {
      const polyline = L.polyline(latlngs, {
        color: '#e74c3c',
        weight: 4,
        opacity: 0.8
      });
      currentGpxLayer.addLayer(polyline);
    }

    // Processar waypoints
    for (let i = 0; i < wayPoints.length; i++) {
      const lat = parseFloat(wayPoints[i].getAttribute('lat'));
      const lon = parseFloat(wayPoints[i].getAttribute('lon'));
      if (!isNaN(lat) && !isNaN(lon)) {
        const name = wayPoints[i].getElementsByTagName('name')[0]?.textContent || 'Waypoint';
        const marker = L.marker([lat, lon]).bindPopup(name);
        currentGpxLayer.addLayer(marker);
        latlngs.push([lat, lon]);
      }
    }

    if (latlngs.length === 0) {
      showMessage('Nenhuma coordenada válida encontrada no arquivo', 'error');
      return;
    }

    // Adicionar ao mapa e ajustar visualização
    currentGpxLayer.addTo(map);
    
    if (latlngs.length > 0) {
      const group = new L.featureGroup([currentGpxLayer]);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    showMessage('Rota carregada com sucesso: ' + gpxFiles[index].name, 'success');
    speak('Rota carregada com sucesso.');

    // Tentar entrar em tela cheia (opcional)
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {
        // Ignorar erro silenciosamente
      });
    }

  } catch (error) {
    console.error('Erro ao carregar GPX:', error);
    showMessage('Erro ao carregar rota: ' + error.message, 'error');
  }
};

// Função global para remover GPX
window.removeGPX = function(index) {
  if (gpxFiles[index]) {
    gpxFiles.splice(index, 1);
    updateGPXList();
    showMessage('Arquivo removido', 'success');
    
    // Limpar mapa se necessário
    if (currentGpxLayer) {
      map.removeLayer(currentGpxLayer);
      currentGpxLayer = null;
    }
  }
};

function showMessage(message, type) {
  const messages = document.getElementById('messages');
  const messageClass = type === 'error' ? 'error-message' : 'success-message';
  messages.innerHTML = `<div class="${messageClass}">${message}</div>`;
  
  // Remover mensagem após 5 segundos
  setTimeout(() => {
    messages.innerHTML = '';
  }, 5000);
}

function speak(message) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'pt-BR';
    
    // Aguardar as vozes carregarem
    const setVoice = () => {
      const voices = synth.getVoices();
      const ptBrVoice = voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt');
      if (ptBrVoice) {
        utterance.voice = ptBrVoice;
      }
    };
    
    if (synth.getVoices().length > 0) {
      setVoice();
    } else {
      synth.addEventListener('voiceschanged', setVoice);
    }
    
    synth.speak(utterance);
  } catch (error) {
    console.warn('Erro na síntese de voz:', error);
  }
}