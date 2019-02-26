# ServiceDeskSampleBot
Mock function to simulate a ticket service

# Deploying the function
Deploy this function via Visual Studio Code following the procedures [here](https://code.visualstudio.com/tutorials/functions-extension/deploy-app)

# Required Environment
1. Provision a Cosmos DB instance to hold tickets created by the function
2. Deploy the function app that is in the folder ticket-dummy-service
	- After deployed go to the application settings and add the following settings:
		- HOST: CosmosDB URL
		- AUTH_KEY: Cosmos DB Key