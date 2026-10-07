<template>
  <ion-page>
    <ion-content :fullscreen="true" class="app-content">
      <div class="app-shell">
        <header class="topbar">
          <button v-if="app.screen !== 'home'" class="icon-button back-button" aria-label="Voltar" @click="back">
            <ion-icon :icon="arrowBackOutline" />
          </button>
          <button v-else class="brand-lockup" aria-label="BURRO início" @click="app.returnHome()">
            <span class="brand-symbol"><span></span><span></span><span></span></span>
            <span>BURRO</span>
          </button>
          <div class="topbar-right">
            <span class="offline-badge"><span class="status-light"></span> OFFLINE</span>
            <button v-if="app.screen !== 'history' && app.screen !== 'details'" class="icon-button history-shortcut" aria-label="Histórico" @click="app.openHistory()">
              <ion-icon :icon="timeOutline" />
            </button>
          </div>
        </header>

        <main class="screen-frame">
          <div v-if="app.error" class="feedback error-feedback" role="alert">
            <span>{{ app.error }}</span>
            <button aria-label="Fechar mensagem" @click="app.error = ''"><ion-icon :icon="closeOutline" /></button>
          </div>
          <div v-if="app.notice" class="feedback notice-feedback" role="status">
            <span>{{ app.notice }}</span>
            <button aria-label="Fechar mensagem" @click="app.notice = ''"><ion-icon :icon="closeOutline" /></button>
          </div>

          <section v-if="app.screen === 'home'" class="home-screen page-enter">
            <div class="home-kicker"><span class="kicker-line"></span> JOGO DE RODA · 2 A 6 PESSOAS</div>
            <div class="hero-layout">
              <div class="hero-copy">
                <h1>Uma carta<br />de cada vez.<br /><em>Sem escapatória.</em></h1>
                <p>Forme sua quadra. Passe a carta. Não deixe o BURRO cair no seu colo.</p>
                <button class="button-primary hero-button" @click="app.continueToIdentity()">
                  Abrir uma mesa <ion-icon :icon="arrowForwardOutline" />
                </button>
              </div>
              <div class="card-art" aria-hidden="true">
                <div class="art-card art-card-back"><span>R</span><small>BURRO</small></div>
                <div class="art-card art-card-middle"><small>Q</small><span>♣</span></div>
                <div class="art-card art-card-front"><small>4</small><span>♦</span><b>4</b></div>
                <div class="art-stamp">SEM<br />INTERNET</div>
              </div>
            </div>
            <div class="home-footer">
              <span><b>01</b> Uma quadra de iguais</span>
              <span><b>02</b> Cinco letras encerram o jogo</span>
              <button class="text-button" @click="app.openHistory()">Ver histórico <ion-icon :icon="arrowForwardOutline" /></button>
            </div>
            <div class="home-note"><ion-icon :icon="bluetoothOutline" /> Partidas locais via Bluetooth · Android</div>
          </section>

          <section v-else-if="app.screen === 'identity'" class="form-screen page-enter">
            <div class="section-number">01 / IDENTIFICAÇÃO</div>
            <h1>Como te<br /><em>chamam?</em></h1>
            <p class="lead">Escolha um nome para esta mesa. Até 20 caracteres.</p>
            <form class="identity-form" @submit.prevent="app.continueToModes()">
              <label for="player-name">Seu nome</label>
              <input id="player-name" v-model="app.playerNameInput" maxlength="20" autocomplete="nickname" placeholder="Ex.: Rafa" autofocus />
              <p v-if="app.identityError" class="field-error" role="alert">{{ app.identityError }}</p>
              <button class="button-primary full-button" type="submit">Continuar <ion-icon :icon="arrowForwardOutline" /></button>
            </form>
            <p class="privacy-line"><ion-icon :icon="lockClosedOutline" /> Seu nome fica salvo apenas neste aparelho.</p>
          </section>

          <section v-else-if="app.screen === 'choose'" class="choose-screen page-enter">
            <div class="section-number">02 / NOVA MESA</div>
            <h1>Escolha seu<br /><em>lugar.</em></h1>
            <p class="lead">Olá, {{ app.playerName }}. Convide quem está por perto.</p>
            <div class="mode-list">
              <button class="mode-row create-row" :disabled="app.busy" @click="app.createRoom()">
                <span class="mode-icon"><ion-icon :icon="addOutline" /></span>
                <span class="mode-copy"><b>Criar uma mesa</b><small>Você será o anfitrião</small></span>
                <ion-icon class="mode-arrow" :icon="arrowForwardOutline" />
              </button>
              <button class="mode-row" :disabled="app.busy" @click="app.findRooms()">
                <span class="mode-icon search-icon"><ion-icon :icon="bluetoothOutline" /></span>
                <span class="mode-copy"><b>Procurar mesas</b><small>Descobrir jogadores próximos</small></span>
                <ion-icon class="mode-arrow" :icon="arrowForwardOutline" />
              </button>
            </div>
            <div class="bluetooth-callout"><span class="bluetooth-pulse"><ion-icon :icon="bluetoothOutline" /></span><div><b>Conexão local</b><small>Sem internet. O Android pedirá acesso ao Bluetooth.</small></div></div>
            <button class="text-button edit-name" @click="app.screen = 'identity'">Trocar nome</button>
          </section>

          <section v-else-if="app.screen === 'search'" class="search-screen page-enter">
            <div class="section-number">BLUETOOTH / DESCOBERTA</div>
            <h1>Mesas<br /><em>por perto.</em></h1>
            <div class="scan-status" :class="{ scanning: app.scanning }">
              <span class="scan-orbit"><ion-icon :icon="bluetoothOutline" /></span>
              <div><b>{{ app.scanning ? 'Procurando mesas' : 'Busca encerrada' }}</b><small>{{ app.scanning ? 'Mantenha esta tela aberta.' : `${app.rooms.length} mesa(s) encontrada(s)` }}</small></div>
              <button v-if="app.scanning" class="icon-button" aria-label="Parar busca" @click="stopSearch"><ion-icon :icon="closeOutline" /></button>
            </div>
            <div v-if="app.rooms.length" class="room-list">
              <button v-for="room in app.rooms" :key="room.address" class="room-row" :disabled="app.busy" @click="app.joinRoom(room)">
                <span class="room-rssi"><ion-icon :icon="radioOutline" /></span>
                <span class="room-copy"><b>{{ room.name }}</b><small>Sala BLE próxima · {{ room.rssi }} dBm</small></span>
                <span class="room-join">Entrar <ion-icon :icon="arrowForwardOutline" /></span>
              </button>
            </div>
            <div v-else-if="!app.scanning" class="empty-state"><span class="empty-mark">∅</span><b>Nenhuma mesa encontrada</b><small>Confira se o anfitrião está anunciando uma sala e tente novamente.</small></div>
            <button v-if="!app.scanning" class="button-primary full-button" :disabled="app.busy" @click="app.findRooms()">Buscar novamente <ion-icon :icon="refreshOutline" /></button>
            <div v-if="app.busy" class="connecting-line"><ion-spinner name="crescent" /> Conectando e lendo a sala...</div>
          </section>

          <section v-else-if="app.screen === 'lobby' && app.game" class="lobby-screen page-enter">
            <div class="section-number">SALA DE ESPERA / {{ app.game.code }}</div>
            <div class="lobby-heading"><div><h1>A mesa<br /><em>está aberta.</em></h1><p class="lead">{{ app.game.players.length }} de 6 lugares ocupados</p></div><div class="table-seal"><span>R</span><small>{{ app.game.code }}</small></div></div>
            <div class="connection-strip"><span class="connection-dot" :class="{ live: app.connectionLabel.includes('conectado') || app.connectionLabel.includes('Anunciando') }"></span>{{ app.connectionLabel }}</div>
            <div v-if="app.joinRequests.length" class="request-list">
              <div class="list-label">PEDIDOS DE ENTRADA <span>{{ app.joinRequests.length }}</span></div>
              <div v-for="request in app.joinRequests" :key="request.id" class="request-row"><div class="player-avatar">{{ request.name.slice(0, 1).toUpperCase() }}</div><b>{{ request.name }}</b><div class="request-actions"><button class="accept-button" :aria-label="`Aceitar ${request.name}`" @click="app.decideRequest(request, true)"><ion-icon :icon="checkmarkOutline" /></button><button class="reject-button" :aria-label="`Recusar ${request.name}`" @click="app.decideRequest(request, false)"><ion-icon :icon="closeOutline" /></button></div></div>
            </div>
            <div class="list-label">JOGADORES <span>{{ app.game.players.length }} / 6</span></div>
            <div class="player-list">
              <div v-for="player in [...app.game.players].sort((a, b) => a.order - b.order)" :key="player.id" class="player-row">
                <div class="player-avatar" :class="{ host: player.isHost }">{{ player.name.slice(0, 1).toUpperCase() }}</div>
                <div class="player-copy"><b>{{ player.name }} <small v-if="player.id === app.localPlayerId">VOCÊ</small></b><span>{{ player.isHost ? 'Anfitrião' : 'Jogador' }} · lugar {{ player.order + 1 }}</span></div>
                <span class="player-connection" :class="{ connected: player.connected }"><i></i>{{ player.connected ? 'Conectado' : 'Offline' }}</span>
              </div>
              <div v-for="index in 6 - app.game.players.length" :key="`empty-${index}`" class="player-row empty-player"><div class="player-avatar dashed">+</div><span>Aguardando jogador</span></div>
            </div>
            <p v-if="!app.isHost" class="waiting-note"><span class="waiting-pulse"></span>{{ app.connectionLabel.includes('aprovação') ? 'Aguardando aprovação do anfitrião...' : 'Aguardando início da partida...' }}</p>
            <button v-if="app.isHost" class="button-primary full-button start-button" :disabled="app.game.players.length < 2" @click="app.beginGame()">{{ app.game.players.length < 2 ? 'Aguardando mais alguém' : 'Iniciar partida' }} <ion-icon :icon="playOutline" /></button>
            <button class="text-button leave-button" @click="app.leaveRoom()">Sair da sala</button>
          </section>

          <section v-else-if="app.screen === 'game' && app.game" class="game-screen page-enter">
            <div class="game-topline"><div><span class="section-number">RODADA {{ String(app.game.round).padStart(2, '0') }}</span><b class="game-code">{{ app.game.code }}</b></div><span class="connection-mini"><i :class="{ live: app.connectionLabel.includes('Conectado') || app.connectionLabel.includes('conectado') }"></i>{{ app.connectionLabel.includes('Conectado') || app.connectionLabel.includes('conectado') ? 'Conectado' : 'Sem conexão' }}</span></div>
            <div class="table-felt">
              <div class="table-ring"></div>
              <div class="table-center"><div class="center-card"><span>R</span><small>BURRO</small></div><b>{{ app.activePlayer?.id === app.localPlayerId ? 'SUA VEZ' : `VEZ DE ${app.activePlayer?.name ?? '...'}` }}</b><small>{{ app.isMyTurn ? 'Escolha uma carta para passar.' : 'Aguarde sua vez.' }}</small></div>
              <div v-for="player in app.game.players" :key="player.id" class="seat" :class="[`seat-${player.order}`, { 'seat-active': player.id === app.game.currentPlayerId, 'seat-local': player.id === app.localPlayerId }]">
                <div class="seat-avatar">{{ player.name.slice(0, 1).toUpperCase() }}<span v-if="player.id === app.game.currentPlayerId" class="turn-star">✦</span></div>
                <b>{{ player.id === app.localPlayerId ? 'Você' : player.name }}</b>
                <small>{{ player.isHost ? 'ANFITRIÃO' : `LUGAR ${player.order + 1}` }}</small>
                <div class="penalty-track" :aria-label="`${player.penalty} letras de BURRO`"><span v-for="letter in 5" :key="letter" :class="{ earned: letter <= player.penalty }">{{ 'BURRO'[letter - 1] }}</span></div>
              </div>
            </div>
            <div class="direction-line"><span><i class="direction-dot receiving"></i>Recebe de <b>{{ app.previousPlayer?.name ?? '—' }}</b></span><span class="direction-arrow">←</span><span>Passa para <b>{{ app.nextPlayer?.name ?? '—' }}</b><i class="direction-dot sending"></i></span></div>
            <div class="hand-heading"><div><span class="section-number">SUA MÃO</span><b>{{ app.localHand.length }} CARTAS</b></div><span v-if="app.isMyTurn" class="your-turn-label">É sua vez</span><span v-else class="wait-turn-label">Turno de {{ app.activePlayer?.name ?? '...' }}</span></div>
            <div class="hand" :class="{ disabled: !app.isMyTurn || app.movePending }">
              <button v-for="card in app.localHand" :key="card.id" class="playing-card" :class="{ selected: app.selectedCardId === card.id }" :disabled="!app.isMyTurn || app.movePending" :aria-pressed="app.selectedCardId === card.id" @click="app.chooseCard(card.id)">
                <span class="card-corner">{{ card.value }}</span><span class="card-face">{{ card.value }}</span><span class="card-caption">PASSAR</span>
              </button>
            </div>
            <button class="button-primary full-button confirm-button" :disabled="!app.isMyTurn || !app.selectedCardId || app.movePending" @click="app.confirmCard()">{{ app.movePending ? 'Aguardando anfitrião...' : 'Confirmar troca' }} <ion-icon :icon="arrowForwardOutline" /></button>
            <button class="text-button game-leave" @click="app.leaveRoom()">Sair da partida</button>
          </section>

          <section v-else-if="app.screen === 'result' && app.game" class="result-screen page-enter">
            <div class="result-stamp"><ion-icon :icon="trophyOutline" /></div>
            <div class="section-number">FIM DE JOGO / {{ app.game.code }}</div>
            <h1>{{ app.game.result?.winnerId ? 'Quadra!' : 'Partida<br />interrompida.' }}</h1>
            <p class="lead">{{ app.game?.result?.winnerId ? `${app.game.players.find((player) => player.id === app.game?.result?.winnerId)?.name} fechou quatro iguais.` : app.notice || 'A conexão foi encerrada antes do fim.' }}</p>
            <div class="result-score"><div><span>RODADAS</span><b>{{ app.game.round }}</b></div><div><span>SUA PENALIDADE</span><b>{{ 'BURRO'.slice(0, app.localPlayer?.penalty ?? 0) || '—' }}</b></div><div><span>ENCERRAMENTO</span><b>{{ app.game.result?.reason ?? 'Partida interrompida' }}</b></div></div>
            <div class="result-players"><span class="list-label">PARTICIPANTES</span><div v-for="player in [...app.game.players].sort((a, b) => a.order - b.order)" :key="player.id" class="result-player"><span>{{ String(player.order + 1).padStart(2, '0') }}</span><b>{{ player.name }}</b><small>{{ player.id === app.game.result?.winnerId ? 'VENCEDOR' : `${player.penalty}/5 LETRAS` }}</small></div></div>
            <button class="button-primary full-button" @click="app.returnHome()">Voltar ao início <ion-icon :icon="arrowForwardOutline" /></button>
            <button class="text-button full-text-button" @click="app.openDetails({ ...app.game, localPlayerId: app.localPlayerId })">Ver detalhes da partida</button>
          </section>

          <section v-else-if="app.screen === 'history'" class="history-screen page-enter">
            <div class="section-number">ARQUIVO LOCAL / {{ app.history.length }} PARTIDAS</div>
            <div class="history-heading"><h1>Seu<br /><em>histórico.</em></h1><button v-if="app.history.length" class="icon-button delete-all" aria-label="Limpar histórico" @click="app.clearHistory()"><ion-icon :icon="trashOutline" /></button></div>
            <div v-if="app.history.length" class="history-list">
              <div v-for="entry in app.history" :key="entry.id" class="history-row">
                <button class="history-open" @click="app.openDetails(entry)"><span class="history-date">{{ formatDate(entry.startedAt ?? entry.endedAt) }}</span><b>{{ entry.players.map((player) => player.name).join(' · ') }}</b><small>{{ entry.round }} rodadas · {{ entry.result?.reason ?? 'Interrompida' }}</small><span class="history-result">{{ entry.result?.winnerId ? entry.players.find((player) => player.id === entry.result?.winnerId)?.name + ' venceu' : 'Sem vencedor' }} <ion-icon :icon="arrowForwardOutline" /></span></button>
                <button class="delete-entry" :aria-label="`Excluir partida de ${formatDate(entry.startedAt ?? entry.endedAt)}`" @click="app.removeHistoryEntry(entry)"><ion-icon :icon="trashOutline" /></button>
              </div>
            </div>
            <div v-else class="empty-state history-empty"><span class="empty-mark">00</span><b>Nenhuma partida salva</b><small>As partidas concluídas e interrompidas aparecem aqui.</small></div>
            <button class="text-button history-home" @click="app.returnHome()"><ion-icon :icon="arrowBackOutline" /> Voltar ao início</button>
          </section>

          <section v-else-if="app.screen === 'details' && app.selectedHistory" class="details-screen page-enter">
            <div class="section-number">REGISTRO / {{ app.selectedHistory.code }}</div>
            <h1>Detalhes<br /><em>da mesa.</em></h1>
            <div class="detail-block"><span>INÍCIO</span><b>{{ formatDateTime(app.selectedHistory.startedAt) }}</b><span>ENCERRAMENTO</span><b>{{ formatDateTime(app.selectedHistory.endedAt) }}</b></div>
            <div class="detail-block"><span>RESULTADO</span><b>{{ app.selectedHistory.result?.winnerId ? `${app.selectedHistory.players.find((player) => player.id === app.selectedHistory?.result?.winnerId)?.name} venceu` : 'Partida sem vencedor' }}</b><span>MOTIVO</span><b>{{ app.selectedHistory.result?.reason ?? 'Interrompida' }}</b><span>RODADAS</span><b>{{ app.selectedHistory.round }}</b></div>
            <div class="result-players"><span class="list-label">ORDEM DOS JOGADORES</span><div v-for="player in [...app.selectedHistory.players].sort((a, b) => a.order - b.order)" :key="player.id" class="result-player"><span>{{ String(player.order + 1).padStart(2, '0') }}</span><b>{{ player.name }}</b><small>{{ player.penalty }}/5 LETRAS</small></div></div>
            <button class="button-primary full-button" @click="app.screen = 'history'"><ion-icon :icon="arrowBackOutline" /> Voltar ao histórico</button>
          </section>
        </main>
        <footer class="app-footer"><span>BURRO / CARTAS ENTRE AMIGOS</span><span>v1.0 <i></i> {{ app.game?.code ?? 'SEM MESA' }}</span></footer>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { reactive } from 'vue';
import { IonContent, IonIcon, IonPage, IonSpinner } from '@ionic/vue';
import {
  addOutline, arrowBackOutline, arrowForwardOutline, bluetoothOutline, checkmarkOutline,
  closeOutline, lockClosedOutline, playOutline, radioOutline, refreshOutline, timeOutline,
  trophyOutline, trashOutline,
} from 'ionicons/icons';
import { useGameApp } from '@/composables/useGameApp';
import { bluetoothService } from '@/services/bluetooth/BluetoothService';

const app = reactive(useGameApp());

function formatDate(value?: number | null): string {
  return value ? new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Data indisponível';
}

function formatDateTime(value?: number | null): string {
  return value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }) : 'Não registrado';
}

async function stopSearch(): Promise<void> {
  await bluetoothService.stopScan();
  app.scanning = false;
}

function back(): void {
  if (app.screen === 'identity') app.screen = 'home';
  else if (app.screen === 'choose') app.screen = 'identity';
  else if (app.screen === 'search') app.screen = 'choose';
  else if (app.screen === 'history') app.screen = 'home';
  else if (app.screen === 'details') app.screen = 'history';
  else if (app.screen === 'lobby' || app.screen === 'game') void app.leaveRoom();
  else if (app.screen === 'result') void app.returnHome();
}
</script>

<style scoped>
:global(body) { background: #f2f0e8; }
.app-content { --background: #f2f0e8; }
.app-shell { min-height: 100%; max-width: 1040px; margin: 0 auto; padding: max(18px, env(safe-area-inset-top)) 26px max(14px, env(safe-area-inset-bottom)); color: #15241f; display: flex; flex-direction: column; }
.topbar { height: 52px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d8d8ce; flex-shrink: 0; }
.brand-lockup { display: inline-flex; align-items: center; gap: 10px; border: 0; background: none; padding: 0; color: #17251f; font-size: 14px; font-weight: 900; letter-spacing: 0; }
.brand-symbol { display: flex; gap: 2px; align-items: end; height: 20px; }
.brand-symbol span { width: 7px; height: 13px; border: 1.5px solid #c94f35; border-radius: 2px; transform: rotate(-12deg); }
.brand-symbol span:nth-child(2) { height: 17px; transform: rotate(0); background: #c94f35; }
.brand-symbol span:nth-child(3) { transform: rotate(12deg); }
.topbar-right { display: flex; align-items: center; gap: 13px; }
.offline-badge, .connection-mini { display: inline-flex; align-items: center; gap: 7px; font-size: 9px; font-weight: 800; letter-spacing: 0; color: #65716b; }
.status-light { width: 6px; height: 6px; border-radius: 50%; background: #c3a440; }
.icon-button { width: 40px; height: 40px; display: inline-grid; place-items: center; padding: 0; border: 1px solid #d4d5cb; border-radius: 50%; color: #20352d; background: transparent; font-size: 19px; }
.icon-button:active { background: #e6e6dc; }
.back-button { border: 0; margin-left: -9px; font-size: 21px; }
.screen-frame { flex: 1; display: flex; flex-direction: column; position: relative; }
.page-enter { animation: enter .42s ease both; }
@keyframes enter { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0); } }
.home-screen { flex: 1; padding-top: clamp(36px, 8vh, 92px); display: flex; flex-direction: column; }
.home-kicker, .section-number { font-size: 9px; color: #77837b; font-weight: 800; letter-spacing: 0; }
.home-kicker { display: flex; align-items: center; gap: 9px; }
.kicker-line { width: 25px; height: 2px; background: #c94f35; }
.hero-layout { display: grid; grid-template-columns: 1.1fr .9fr; align-items: center; min-height: 360px; }
.hero-copy { position: relative; z-index: 1; padding: 24px 0 34px; }
h1 { margin: 20px 0 16px; color: #17251f; font: 700 clamp(42px, 8vw, 76px)/.98 Georgia, 'Times New Roman', serif; letter-spacing: 0; }
h1 em { color: #bd4b34; font-weight: 400; }
.hero-copy p, .lead { max-width: 390px; color: #67736d; font-size: 14px; line-height: 1.65; margin: 0 0 25px; }
.button-primary { min-height: 54px; padding: 0 21px; display: inline-flex; align-items: center; justify-content: center; gap: 16px; border: 0; border-radius: 3px; color: #f8f6ed; background: #1e3a30; font-size: 13px; font-weight: 800; transition: background .2s, transform .2s; }
.button-primary:hover:not(:disabled) { background: #2b5244; transform: translateY(-1px); }
.button-primary:disabled { background: #b9c0b9; color: #f4f4ed; }
.hero-button { min-width: 206px; }
.hero-button ion-icon, .button-primary ion-icon { font-size: 18px; }
.card-art { height: 320px; width: 100%; position: relative; display: grid; place-items: center; }
.art-card { width: 150px; height: 220px; border: 1px solid rgba(27, 43, 35, .16); border-radius: 8px; position: absolute; display: flex; flex-direction: column; padding: 16px; box-shadow: 0 18px 30px rgba(25, 44, 34, .12); }
.art-card-back { background: #ba4a34; color: #fbf5e5; align-items: center; justify-content: center; transform: translate(-60px, 0) rotate(-15deg); }
.art-card-back span { font: 700 70px Georgia, serif; opacity: .92; }
.art-card-back small { font-size: 8px; font-weight: 800; letter-spacing: 0; }
.art-card-middle { background: #274d3e; color: #f3f0e4; transform: translate(0, -7px) rotate(1deg); justify-content: space-between; }
.art-card-middle small, .art-card-front small { font: 700 28px Georgia, serif; }
.art-card-middle span { align-self: center; font-size: 65px; }
.art-card-front { background: #f9f5e9; color: #bd4b34; transform: translate(60px, 6px) rotate(13deg); justify-content: space-between; }
.art-card-front span { font-size: 55px; align-self: center; }
.art-card-front b { align-self: end; font: 700 27px Georgia, serif; transform: rotate(180deg); }
.art-stamp { position: absolute; right: 5%; bottom: 8px; padding: 8px 11px; border: 1px solid #b38b2d; color: #987725; font-size: 8px; line-height: 1.3; font-weight: 900; transform: rotate(-8deg); }
.home-footer { border-top: 1px solid #d8d8ce; border-bottom: 1px solid #d8d8ce; display: flex; align-items: center; gap: 27px; min-height: 61px; }
.home-footer > span { color: #67736d; font-size: 10px; }
.home-footer > span b { color: #c14c34; font-size: 9px; padding-right: 5px; }
.text-button { display: inline-flex; gap: 7px; align-items: center; padding: 8px 0; border: 0; background: transparent; color: #365748; font-size: 11px; font-weight: 800; }
.home-footer .text-button { margin-left: auto; }
.home-note { display: flex; align-items: center; gap: 8px; padding: 15px 0 7px; color: #7e8982; font-size: 10px; }
.home-note ion-icon { color: #577b68; font-size: 16px; }
.app-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #d8d8ce; padding-top: 11px; color: #8c958e; font-size: 8px; font-weight: 800; letter-spacing: 0; }
.app-footer span:last-child { display: flex; gap: 7px; align-items: center; }
.app-footer i { width: 4px; height: 4px; border-radius: 50%; background: #c74d35; }
.form-screen, .choose-screen, .search-screen, .lobby-screen, .history-screen, .details-screen, .result-screen { width: 100%; max-width: 650px; margin: 0 auto; padding: clamp(32px, 8vh, 76px) 0 42px; }
.form-screen h1, .choose-screen h1, .search-screen h1, .history-screen h1, .details-screen h1, .result-screen h1 { font-size: clamp(46px, 10vw, 70px); }
.form-screen .lead, .choose-screen .lead, .search-screen .lead { margin-bottom: 31px; }
.identity-form { max-width: 430px; display: flex; flex-direction: column; gap: 10px; }
.identity-form label { margin-top: 5px; color: #495950; font-size: 11px; font-weight: 800; }
.identity-form input { width: 100%; height: 56px; padding: 0 15px; border: 1px solid #c9cec4; border-radius: 2px; outline: none; background: #fbfaf5; color: #1e3128; font-size: 16px; }
.identity-form input:focus { border-color: #365748; box-shadow: 0 0 0 2px rgba(54, 87, 72, .12); }
.full-button { width: 100%; margin-top: 15px; }
.field-error { margin: 0; color: #b1402e; font-size: 12px; }
.privacy-line { display: flex; align-items: center; gap: 7px; color: #818c83; font-size: 10px; margin-top: 18px; }
.privacy-line ion-icon { font-size: 14px; }
.mode-list { display: grid; border-top: 1px solid #d2d4ca; }
.mode-row { width: 100%; display: flex; align-items: center; gap: 15px; padding: 17px 5px; border: 0; border-bottom: 1px solid #d2d4ca; text-align: left; background: transparent; color: #20352d; }
.mode-row:disabled { opacity: .6; }
.mode-icon { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; background: #e7e8dc; color: #375a48; font-size: 22px; }
.create-row .mode-icon { background: #dfe8d2; color: #3f643c; }
.mode-copy { flex: 1; display: flex; flex-direction: column; gap: 5px; }
.mode-copy b { font-size: 14px; }
.mode-copy small { color: #7a857d; font-size: 11px; }
.mode-arrow { color: #88948a; font-size: 17px; }
.bluetooth-callout { display: flex; align-items: center; gap: 12px; padding: 17px 0; margin-top: 17px; border-bottom: 1px solid #d2d4ca; }
.bluetooth-pulse { width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid #c6d0c3; border-radius: 50%; color: #486e54; font-size: 18px; }
.bluetooth-callout div { display: flex; flex-direction: column; gap: 4px; }
.bluetooth-callout b { font-size: 11px; }
.bluetooth-callout small { color: #7c877f; font-size: 10px; }
.edit-name { margin-top: 13px; }
.feedback { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; max-width: 650px; width: 100%; padding: 11px 12px; margin: 13px auto 0; font-size: 11px; line-height: 1.5; }
.feedback button { flex: 0 0 24px; width: 24px; height: 24px; border: 0; background: transparent; font-size: 17px; color: inherit; }
.error-feedback { color: #9a3425; border-left: 3px solid #be4b34; background: #f6e7df; }
.notice-feedback { color: #345646; border-left: 3px solid #688d63; background: #e6ecdf; }
.scan-status { display: flex; align-items: center; gap: 13px; padding: 13px 0; margin-bottom: 18px; border-top: 1px solid #d4d6cc; border-bottom: 1px solid #d4d6cc; }
.scan-status > div { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.scan-status b { font-size: 12px; }
.scan-status small { color: #7b867f; font-size: 10px; }
.scan-orbit { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #c3d0c1; border-radius: 50%; color: #3b7353; font-size: 17px; }
.scan-status.scanning .scan-orbit { animation: pulse 1.7s infinite; }
@keyframes pulse { 50% { box-shadow: 0 0 0 7px rgba(91, 133, 94, .12); } }
.room-list { display: grid; }
.room-row { width: 100%; display: flex; align-items: center; gap: 12px; padding: 15px 2px; text-align: left; border: 0; border-bottom: 1px solid #d5d6cd; background: transparent; color: #20352d; }
.room-rssi { width: 37px; height: 37px; display: grid; place-items: center; border: 1px solid #c8d2c5; border-radius: 50%; color: #456d52; font-size: 17px; }
.room-copy { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.room-copy b { font-size: 12px; }
.room-copy small { color: #7f8982; font-size: 9px; }
.room-join { display: flex; align-items: center; gap: 5px; color: #41634d; font-size: 10px; font-weight: 800; }
.empty-state { min-height: 190px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; text-align: center; color: #6e7a72; }
.empty-mark { color: #bd4b34; font: 400 37px Georgia, serif; }
.empty-state b { color: #26392f; font-size: 13px; }
.empty-state small { max-width: 270px; color: #7e8982; font-size: 10px; line-height: 1.6; }
.connecting-line { display: flex; align-items: center; gap: 9px; justify-content: center; padding: 14px; color: #53715e; font-size: 11px; }
.lobby-screen { max-width: 720px; }
.lobby-heading { display: flex; align-items: center; justify-content: space-between; }
.lobby-heading h1 { font-size: clamp(43px, 9vw, 68px); }
.lobby-heading .lead { margin: 0 0 20px; font-size: 12px; }
.table-seal { width: 68px; height: 68px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #bdc8b8; border-radius: 50%; color: #557454; transform: rotate(7deg); }
.table-seal span { font: 700 30px Georgia, serif; line-height: 1; }
.table-seal small { font-size: 7px; font-weight: 900; letter-spacing: 0; }
.connection-strip { display: flex; align-items: center; gap: 8px; padding: 10px 12px; margin: 7px 0 23px; background: #e7e9df; color: #52655a; font-size: 10px; }
.connection-dot, .player-connection i, .connection-mini i { width: 7px; height: 7px; display: inline-block; border-radius: 50%; background: #c58542; }
.connection-dot.live, .player-connection.connected i, .connection-mini i.live { background: #4e8954; }
.list-label { display: flex; justify-content: space-between; padding: 10px 0; color: #77847a; font-size: 9px; font-weight: 900; letter-spacing: 0; border-bottom: 1px solid #d2d4ca; }
.list-label span { color: #bb4a34; }
.player-row, .request-row { display: flex; align-items: center; gap: 11px; min-height: 61px; border-bottom: 1px solid #d9dbd2; }
.player-avatar { flex: 0 0 34px; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%; background: #dce4d4; color: #31523f; font: 700 14px Georgia, serif; }
.player-avatar.host { background: #f0ded3; color: #ad4732; }
.player-avatar.dashed { border: 1px dashed #bfc5ba; background: transparent; color: #8b968c; font: 400 18px system-ui, sans-serif; }
.player-copy { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.player-copy b { font-size: 12px; }
.player-copy b small { margin-left: 4px; color: #b14b35; font-size: 8px; }
.player-copy span, .empty-player > span:last-child { color: #849087; font-size: 9px; }
.player-connection { display: flex; align-items: center; gap: 5px; color: #8a928b; font-size: 9px; }
.player-connection.connected { color: #547457; }
.empty-player { opacity: .75; }
.request-list { margin: 0 0 15px; }
.request-row { min-height: 54px; }
.request-row > b { flex: 1; font-size: 12px; }
.request-actions { display: flex; gap: 7px; }
.request-actions button { width: 33px; height: 33px; display: grid; place-items: center; border: 0; border-radius: 50%; font-size: 17px; }
.accept-button { background: #dce9d9; color: #426747; }
.reject-button { background: #f2e1db; color: #a84a38; }
.waiting-note { display: flex; gap: 9px; align-items: center; justify-content: center; padding: 20px 0 10px; color: #61746a; font-size: 11px; }
.waiting-pulse { width: 7px; height: 7px; border-radius: 50%; background: #c18c34; animation: pulse 1.5s infinite; }
.start-button { margin-top: 19px; }
.leave-button { display: flex; justify-content: center; width: 100%; margin-top: 7px; color: #a24838; }
.game-screen { width: 100%; max-width: 760px; margin: 0 auto; padding: 22px 0 34px; }
.game-topline { display: flex; justify-content: space-between; align-items: center; }
.game-topline > div { display: flex; flex-direction: column; gap: 5px; }
.game-code { color: #8a938a; font-size: 9px; }
.connection-mini { font-size: 8px; }
.connection-mini i { width: 6px; height: 6px; background: #c58542; }
.table-felt { min-height: 330px; position: relative; display: grid; place-items: center; margin: 17px 0 0; overflow: hidden; border-radius: 160px; background: radial-gradient(ellipse at 50% 45%, #426b4f 0%, #284d3d 58%, #1c392f 100%); box-shadow: inset 0 0 0 7px rgba(218, 212, 184, .14), inset 0 0 0 9px rgba(15, 39, 30, .18); color: #f5f1e3; }
.table-ring { position: absolute; inset: 40px 13%; border: 1px solid rgba(231, 228, 202, .2); border-radius: 50%; }
.table-center { z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.center-card { width: 47px; height: 62px; display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 4px; border: 1px solid rgba(255,255,255,.5); border-radius: 3px; color: #274d3b; background: #f4efdf; transform: rotate(-6deg); }
.center-card span { font: 700 31px Georgia, serif; line-height: 1; }
.center-card small { font-size: 6px; font-weight: 900; }
.table-center > b { color: #fff9e9; font-size: 10px; letter-spacing: 0; }
.table-center > small { color: rgba(255,255,255,.7); font-size: 8px; }
.seat { position: absolute; z-index: 2; min-width: 62px; display: flex; flex-direction: column; align-items: center; gap: 3px; color: #f4f0e4; }
.seat-0 { top: 14px; left: 50%; transform: translateX(-50%); }
.seat-1 { top: 29%; right: 5%; }
.seat-2 { bottom: 22%; right: 11%; }
.seat-3 { bottom: 13px; left: 50%; transform: translateX(-50%); }
.seat-4 { bottom: 22%; left: 11%; }
.seat-5 { top: 29%; left: 5%; }
.seat-avatar { position: relative; width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid rgba(242,238,222,.55); border-radius: 50%; font: 700 13px Georgia, serif; background: rgba(12,35,27,.25); }
.seat-active .seat-avatar { border: 2px solid #e4b74f; color: #ffe194; box-shadow: 0 0 0 4px rgba(228,183,79,.16); }
.seat-local .seat-avatar { background: #f1ead4; color: #254c3c; }
.seat b { max-width: 69px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 8px; }
.seat small { color: rgba(242,238,222,.65); font-size: 6px; font-weight: 800; }
.turn-star { position: absolute; top: -7px; right: -7px; color: #e9bd56; font-size: 10px; }
.penalty-track { display: flex; gap: 1px; }
.penalty-track span { color: rgba(246,242,226,.35); font: 700 6px Georgia, serif; }
.penalty-track span.earned { color: #f2bb6c; }
.direction-line { min-height: 42px; display: flex; align-items: center; justify-content: center; gap: 9px; border-bottom: 1px solid #d2d4ca; color: #738077; font-size: 9px; }
.direction-line span { display: flex; align-items: center; gap: 5px; }
.direction-line b { color: #273e32; }
.direction-arrow { color: #c05037; font-size: 15px; }
.direction-dot { width: 5px; height: 5px; display: inline-block; border-radius: 50%; }
.receiving { background: #7d9c69; }.sending { background: #c3533b; }
.hand-heading { display: flex; justify-content: space-between; align-items: end; padding: 15px 1px 10px; }
.hand-heading > div { display: flex; flex-direction: column; gap: 4px; }
.hand-heading b { color: #869087; font-size: 8px; }
.your-turn-label, .wait-turn-label { color: #457248; font-size: 10px; font-weight: 800; }
.wait-turn-label { color: #89938b; }
.hand { display: flex; justify-content: center; gap: clamp(5px, 2vw, 14px); padding: 2px 0 8px; }
.hand.disabled { opacity: .72; }
.playing-card { flex: 1; max-width: 112px; aspect-ratio: .68; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 7px; border: 1px solid #d2d0c4; border-radius: 6px; background: #fbf8ee; color: #243a30; box-shadow: 0 3px 0 #d2d0c4, 0 8px 15px rgba(39, 53, 43, .08); transition: transform .18s, box-shadow .18s, border-color .18s; }
.playing-card:disabled { cursor: default; }
.playing-card:not(:disabled):hover { transform: translateY(-4px); }
.playing-card.selected { transform: translateY(-12px); border-color: #c14d35; box-shadow: 0 3px 0 #c14d35, 0 11px 18px rgba(87,47,33,.15); }
.card-corner { position: absolute; top: 8px; left: 9px; color: #b44b37; font: 700 13px Georgia, serif; }
.card-face { color: #294938; font: 700 clamp(28px, 8vw, 46px)/1 Georgia, serif; }
.card-caption { position: absolute; bottom: 8px; color: #a2a69b; font-size: 6px; font-weight: 900; }
.confirm-button { margin-top: 10px; }
.game-leave { display: flex; justify-content: center; width: 100%; margin-top: 2px; color: #9c4b3d; }
.result-screen { text-align: center; max-width: 600px; }
.result-stamp { width: 68px; height: 68px; display: grid; place-items: center; margin: 0 auto 20px; border: 1px solid #d8be6b; border-radius: 50%; color: #a88124; font-size: 29px; }
.result-screen h1 { font-size: clamp(46px, 11vw, 76px); }
.result-screen .lead { margin: 0 auto 25px; }
.result-score { display: grid; grid-template-columns: .7fr 1fr 1.2fr; padding: 17px 0; border-top: 1px solid #d3d5cb; border-bottom: 1px solid #d3d5cb; text-align: left; }
.result-score div { display: flex; flex-direction: column; gap: 7px; padding: 0 9px; border-right: 1px solid #d3d5cb; }
.result-score div:last-child { border: 0; }
.result-score span, .detail-block span { color: #858f86; font-size: 7px; font-weight: 900; }
.result-score b { color: #263d31; font-size: 11px; }
.result-players { margin: 22px 0; text-align: left; }
.result-player { min-height: 41px; display: grid; grid-template-columns: 32px 1fr auto; align-items: center; border-bottom: 1px solid #d9dbd2; }
.result-player > span { color: #be4b34; font: 700 11px Georgia, serif; }
.result-player b { font-size: 11px; }
.result-player small { color: #78847b; font-size: 7px; font-weight: 900; }
.full-text-button { justify-content: center; width: 100%; }
.history-heading { display: flex; align-items: start; justify-content: space-between; }
.history-heading h1 { margin-bottom: 25px; }
.delete-all { margin-top: 25px; color: #a44837; }
.history-list { border-top: 1px solid #d5d7cd; }
.history-row { display: flex; align-items: center; border-bottom: 1px solid #d5d7cd; }
.history-open { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; padding: 14px 4px; text-align: left; border: 0; background: transparent; color: #253b30; }
.history-date { color: #89938b; font-size: 8px; font-weight: 800; }
.history-open b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.history-open small { color: #879087; font-size: 9px; }
.history-result { display: flex; align-items: center; gap: 4px; color: #4e7250; font-size: 9px; font-weight: 800; }
.history-result ion-icon { font-size: 13px; }
.delete-entry { width: 38px; height: 38px; display: grid; place-items: center; border: 0; background: transparent; color: #a74a38; font-size: 16px; }
.history-empty { margin: 10px 0; }
.history-home { margin-top: 10px; }
.detail-block { display: grid; grid-template-columns: 1fr 1.2fr; gap: 9px 12px; padding: 15px 0; border-top: 1px solid #d4d6cc; }
.detail-block b { color: #263b31; font-size: 10px; }
.details-screen .result-players { margin-top: 10px; }

@media (min-width: 760px) {
  .app-shell { padding-right: 48px; padding-left: 48px; }
  .game-screen { padding-top: 28px; }
  .table-felt { min-height: 395px; border-radius: 200px; }
  .seat-0 { top: 19px; }.seat-3 { bottom: 19px; }
}
@media (max-width: 600px) {
  .app-shell { padding-right: 19px; padding-left: 19px; }
  .home-screen { padding-top: 38px; }
  .hero-layout { grid-template-columns: 1fr; min-height: initial; position: relative; }
  .hero-copy { padding: 25px 0 18px; }
  .hero-copy h1 { font-size: clamp(47px, 13vw, 67px); }
  .hero-copy p { max-width: 260px; }
  .card-art { position: absolute; width: 49%; height: 218px; right: -3px; top: 134px; transform: scale(.76); transform-origin: center right; opacity: .9; }
  .art-card { width: 130px; height: 190px; }
  .art-stamp { right: 1%; bottom: -2px; }
  .hero-button { position: relative; z-index: 2; }
  .home-footer { display: grid; grid-template-columns: 1fr 1fr; gap: 7px 10px; padding: 11px 0; }
  .home-footer > span { font-size: 8px; }
  .home-footer .text-button { grid-column: 1 / -1; margin: 0; }
  .home-note { margin-top: auto; }
  .form-screen, .choose-screen, .search-screen, .lobby-screen, .history-screen, .details-screen, .result-screen { padding-top: 39px; }
  .table-felt { min-height: 305px; border-radius: 150px; }
  .table-ring { inset: 39px 8%; }
  .seat-1 { right: 2%; }.seat-2 { right: 7%; }.seat-4 { left: 7%; }.seat-5 { left: 2%; }
  .direction-line { gap: 5px; font-size: 8px; }
  .direction-line span { gap: 4px; }
  .result-score { grid-template-columns: .7fr 1fr 1.1fr; }
  .result-score div { padding: 0 6px; }
  .result-score span { font-size: 6px; }
  .result-score b { font-size: 9px; }
}
@media (max-width: 375px) {
  .app-shell { padding-right: 14px; padding-left: 14px; }
  .card-art { right: -14px; transform: scale(.65); }
  .table-felt { min-height: 285px; }
  .seat { min-width: 54px; }
  .seat-avatar { width: 26px; height: 26px; }
  .seat-1 { right: 0; }.seat-2 { right: 3%; }.seat-4 { left: 3%; }.seat-5 { left: 0; }
  .player-connection { font-size: 8px; }
}
</style>
