const onSubmitCard = async ({ formData }: any) => {
    return new Promise<void>((resolve, reject) => {
      fetch('/api/cartao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, order_id: order.id }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.error) {
            alert('Erro ao processar: ' + data.error)
            reject()
          } else if (data.status === 'rejected') {
            // AGORA O CLIENTE SABE QUE DEU RUIM!
            alert('Cartão recusado pelo emissor. Verifique os dados, o limite e tente novamente.')
            reject()
          } else {
            // Aprovado ou em processamento
            fetchOrder()
            resolve()
          }
        })
        .catch((error) => {
          console.error(error)
          alert('Falha na comunicação com o banco.')
          reject()
        })
    })
  }