describe('BURRO', () => {
  it('shows the offline card game home screen', () => {
    cy.visit('/')
    cy.contains('BURRO')
    cy.contains('Abrir uma mesa')
    cy.contains('Partidas locais via Bluetooth')
  })

  it('requires a player name before continuing', () => {
    cy.visit('/')
    cy.contains('Abrir uma mesa').click()
    cy.contains('Continuar').click()
    cy.contains('Digite seu nome para continuar.')
  })
})
