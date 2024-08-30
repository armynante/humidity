# Humidity

## Description

Humidity is a tool to manage and deploy common infrastructure components. Most personal projects require a database, a web server, and a few other things. Humidity is a tool to manage these components and deploy them to a cloud provider. Create a docker image and define the configureation in a yaml file. All resources will be deployed under a single namespace with a unique subdomain. Services can be cloned, updated, and deleted as needed.

## CLI Usage

```
$ humidity create <service-name> <path-to-yaml>
$ humidity update <service-name> <path-to-yaml>
$ humidity delete <service-name>
$ humidity clone <service-name> <new-service-name>
```

## TODO

- [ ] CLI command that uploads a docker image to a registry and updates the yaml file with the new image tag. It should also shpw the progress of the upload.
- [ ] CLI command that creates a new service by cloning an existing service. It should update the yaml file with the new service name and subdomain.
- [ ] CLI command that deletes a service. It should also delete the namespace and all resources associated with the service.

https://docs.dokploy.com/en/docs/core/get-started/introduction
