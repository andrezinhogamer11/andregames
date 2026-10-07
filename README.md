# BURRO — cartas entre amigos

Aplicativo mobile offline de jogo de cartas para 2 a 6 aparelhos Android próximos. Um aparelho anuncia uma sala BLE e atua como anfitrião e autoridade do estado; os demais entram após aprovação. O histórico fica no aparelho e não há servidor ou serviço de internet.

## Tecnologias

- Vue 3, TypeScript e Ionic Vue para interface e navegação.
- Capacitor 8 para o aplicativo Android.
- Capacitor Device para detectar o SDK e aplicar o fluxo de permissões correto por geração do Android.
- `cordova-plugin-bluetoothle` 6.7.4 para BLE central e periférico, serviço GATT, notificações e descoberta. O plugin BLE mantido pela comunidade Capacitor suporta apenas central e não permite criar a sala anfitriã; por isso não foi usado.
- `localStorage` versão `burro-game-history-v1` para histórico pequeno e preferências. A persistência é local e sobrevive ao fechamento e reinício do app; SQLite não foi adicionado porque os registros são poucos e não precisam de consulta relacional.

## Instalação e execução

Requer Node.js 22+ e Android Studio com SDK Android instalado.

```sh
npm install
npm run dev
```

Para preparar o Android:

```sh
npx cap sync android
npx cap open android
```

No Android Studio, execute em aparelho físico. Para gerar APK de depuração também é possível usar `android/gradlew assembleDebug` no Windows (`android\gradlew.bat assembleDebug`). Emuladores não oferecem BLE utilizável para este teste. O app requer Android com Bluetooth Low Energy.

## Como jogar

1. Informe seu nome e escolha criar ou procurar uma sala.
2. O anfitrião aprova cada pedido. São aceitos de 2 a 6 jogadores.
3. Ao iniciar, o anfitrião cria e embaralha 52 cartas (13 valores, quatro cópias de cada) e distribui quatro para cada jogador. As mãos completas ficam somente no estado autoritativo do anfitrião; cada cliente recebe apenas a própria mão.
4. Os jogadores escolhem uma carta em sequência, na ordem da mesa. Quando todos escolheram, as cartas passam simultaneamente para o jogador seguinte; cada mão continua com quatro cartas. A tela informa de quem recebe e para quem passa.
5. Após cada troca completa, se alguém formar quatro valores iguais, essa pessoa vence a rodada. O jogador seguinte na ordem recebe uma letra de BURRO. A partida termina quando alguém acumula as cinco letras; o último vencedor de rodada é registrado como vencedor final.
6. Sair durante uma partida interrompe e grava o resultado sem vencedor. Desconexão durante partida interrompe com o motivo `desconexão`; no lobby, o jogador fica marcado como desconectado.

O anfitrião verifica turno, rodada, identidade/endereço BLE, existência da carta na mão e conectividade antes de aceitar uma jogada. Clientes não escolhem destinatários nem podem atualizar o estado geral.

## BLE e formato das mensagens

Serviço GATT `d1e50a00-5f6c-4f3a-8d21-2db5a1500001`; característica de leitura/escrita/notificação `d1e50a01-5f6c-4f3a-8d21-2db5a1500001`. A descoberta só lista periféricos que anunciam esse serviço. O periférico fornece metadados públicos da sala; pedidos e jogadas usam escrita GATT; snapshots do anfitrião usam notificações unicast para cada cliente conectado.

Envelope JSON:

```json
{
  "type": "JOGADA",
  "gameId": "id-da-partida",
  "senderId": "id-do-jogador",
  "timestamp": 1730000000000,
  "payload": { "playerId": "id-do-jogador", "cardId": "A-2", "round": 3 }
}
```

Tipos usados: `SOLICITACAO_ENTRADA`, `JOGADOR_ENTROU`, `PARTIDA_INICIADA`, `JOGADA`, `JOGADA_REJEITADA`, `ESTADO_PARTIDA`, `TROCA_REALIZADA`, `JOGADOR_COMPLETOU`, `PARTIDA_FINALIZADA`, `JOGADOR_DESCONECTADO` e `RECONEXAO`. Snapshots carregam a lista pública de jogadores e somente a mão destinada ao cliente. O validador rejeita partida diferente, remetente inexistente, ação exclusiva do anfitrião enviada por convidado, payload inválido, mão que não tenha quatro cartas e lista de jogadores duplicada/malformada.

O limite de escrita BLE tradicional é 20 bytes. `frames.ts` fragmenta JSON em pacotes de até 20 bytes com identificador de transferência e sequência; o receptor remonta os fragmentos antes da validação. Mensagens longas acima de 255 fragmentos são rejeitadas.

## Permissões Android

O manifesto declara `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` e `BLUETOOTH_ADVERTISE` (Android 12 / API 31+), além de `BLUETOOTH`, `BLUETOOTH_ADMIN` e `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` para versões até API 30. Scan usa `neverForLocation`, pois dados não são usados para determinar localização. Android 6–11 pede localização em execução e pode exigir Serviços de Localização ligados para descoberta; Android 12+ pede as permissões BLE modernas, sem pedir localização.

Se uma permissão for negada, a operação para com uma mensagem orientando a ativá-la nas configurações. Bluetooth desligado, plugin não instalado e plataforma não Android também produzem mensagens explícitas.

## Persistência e histórico

Cada encerramento normal, abandono, cancelamento ou desconexão grava automaticamente o estado da partida, participantes, ordem, rodadas, resultado e horários. O histórico permite abrir detalhes, excluir individualmente com confirmação ou limpar tudo com confirmação. Dados são locais ao aparelho; uma partida vista em outro dispositivo não é automaticamente adicionada ao histórico deste cliente.

## Desconexão e limites conhecidos

- Uma desconexão no meio da partida interrompe a partida para impedir mãos divergentes. O anfitrião encerra o estado e envia `JOGADOR_DESCONECTADO` quando o canal ainda responde.
- `RECONEXAO` está definido e validado como tipo de protocolo, mas a retomada completa ainda não foi implementada. BLE GATT e callbacks de reconexão variam entre fabricantes/Android; o app encerra com segurança em vez de prometer retomada.
- Apenas Android é habilitado no adaptador. O plugin escolhido tem APIs de periférico iOS, porém este projeto não configura modos em segundo plano nem valida interoperabilidade Apple.
- A sala BLE é anunciada enquanto o app está em primeiro plano. Manter Android ativo e Bluetooth ligado nos aparelhos; não minimizar durante uma partida de demonstração.
- A versão do plugin Cordova é antiga e exige teste físico em cada versão principal do Android e fabricante. Não foi possível comprovar comunicação entre dois aparelhos neste ambiente de desenvolvimento.
- O anfitrião é a autoridade de jogo, não um servidor criptograficamente autenticado. BLE local identifica conexões por endereço enquanto conectadas, mas o protocolo não oferece antitrapaça contra cliente modificado.

## Testes

```sh
npm run test:unit -- --run
npm run test:e2e
npm run build
```

Os testes unitários cobrem baralho, distribuição, mínimo de jogadores, turno, troca simultânea, BURRO, validação de protocolo, isolamento de fragmentos BLE e persistência/exclusão do histórico. Para teste BLE, instale a mesma build em pelo menos dois aparelhos Android físicos: crie uma sala no primeiro, procure no segundo, aprove no anfitrião e complete uma partida mantendo os dois apps abertos.