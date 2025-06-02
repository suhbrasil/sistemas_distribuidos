.PHONY: start stop

start:
	@echo "Iniciando todos os microsserviços..."
	@node payment-external/index.js & \
	node payment/index.js & \
	node ticket/index.js & \
	node reservation/index.js & \
	node itinerary/index.js & \
	wait

# Para interromper todos facilmente (Ctrl+C para matar todos, ou use stop abaixo)
stop:
	@echo "Parando todos os microsserviços..."
	@pkill -f "node itinerary/index.js" || true
	@pkill -f "node payment/index.js" || true
	@pkill -f "node payment-external/index.js" || true
	@pkill -f "node reservation/index.js" || true
	@pkill -f "node ticket/index.js" || true
