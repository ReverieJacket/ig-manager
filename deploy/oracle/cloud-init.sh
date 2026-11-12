#!/bin/bash
# Cole este conteúdo em: Create instance → Show advanced options →
# Management → Cloud-init script ("Paste cloud-init script").
# A máquina instala tudo sozinha na primeira inicialização (~15 min).
# Para usar outra branch, troque "main" nas duas linhas abaixo.
export IGM_BRANCH=main
curl -fsSL "https://raw.githubusercontent.com/ReverieJacket/ig-manager/${IGM_BRANCH}/deploy/oracle/instalar.sh" -o /root/instalar-ig-manager.sh && bash /root/instalar-ig-manager.sh
