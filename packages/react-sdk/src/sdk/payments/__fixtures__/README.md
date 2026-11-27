Fixture íntegro de GafaPayFront, copiado de
`/workspace/cxb1126/fp-staging-build/dist/main.js` el 2026-11-26.

SHA-256: `16c69c83f04c3d4429ca5575716ebabbdb1be19055b6a53e5a625d5df970db5c`.

El UMD contiene su propio React y una API compilada:
`https://gafapay-api-gafapay-api-test.azurewebsites.net`.
Las pruebas evalúan el archivo sin modificarlo, con credenciales ficticias y
`fetch` interceptado; no descargan scripts ni realizan tráfico de red o cobros.
No se importa en el SDK ni se publica con el embed. El fixture permite ejecutar
el contrato en un checkout independiente del directorio original.

No se ha comprobado que el servidor de staging entregue estos mismos bytes.
Si cambia el bundle desplegado, verificar su contrato de API y actualizar juntos
el fixture, su hash y la guarda del bridge.
