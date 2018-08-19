import { getServiceMetadata, getEndpointMetadata} from '@microgamma/apigator';
import { getDebugger } from '@microgamma/ts-debug';


const debug = getDebugger('microgamma:serveless-apigator');

export class Serverless {

  public hooks: any = {};

  private servicePath: string;
  private entrypoint: string;
  private serviceName;

  constructor(private serverless: any, private options: any) {

    this.options = options;

    serverless.cli.log('Parsing Apigator Service definitions');
    this.servicePath = serverless.config.servicePath;
    debug('servicePath:', this.servicePath);

    const awsService = serverless.service.service;
    this.serviceName = awsService;
    debug('awsService name', awsService);
    debug('stage', this.options.stage);

    const services = serverless.service.custom.services;
    debug('pre defined services', services);
    this.entrypoint = serverless.service.custom.entrypoint;
    debug('entrypoint', this.entrypoint);

    this.hooks = {
      'before:package:initialize': () => {
        debug('before:package:initialize');
        return this.configureFunctions();
      },

      'before:invoke:local:invoke': () => {
        debug('before:invoke:local:invoke');
        return this.configureFunctions();
      }
    };
  }

  public configureFunctions() {

    debug('importing module');

    // const module = require(`${this.servicePath}/${this.entrypoint}`);
    const modulePath = `${this.servicePath}/${this.entrypoint}`;
    return import(modulePath).then((module) => {

      this.serverless.cli.log('Injecting configuration');
      debug('works', module);

      const service = module.default;

      debug('metadata', Reflect.getMetadataKeys(service));
      debug('metadata', Reflect.getMetadata('Endpoint', service));
      debug('Service', getServiceMetadata(service));
      debug('Endpoints', getEndpointMetadata(service));

      const endpoints = getEndpointMetadata(service);

      for (const endpoint of endpoints) {
        debug('configuring endpoint', endpoint);
        const functionName = endpoint.name;

        this.serverless.service.functions[endpoint.name] = {
          name: `${this.serviceName}-${this.options.stage || ''}-${functionName}`,
          handler: `${this.entrypoint}.${functionName}`,
          events: [
            {
              http:  {
                path: endpoint.path,
                method: endpoint.method,
                integration: 'lambda',
                cors: true
              }
            }
          ]
        };

        debug('functions is');
        debug(this.serverless.service.functions[endpoint.name]);
        debug(this.serverless.service.functions[endpoint.name].events);
      }

      this.serverless.cli.log(`${endpoints.length} endpoints configured`);

    }).catch((err) => {
      console.error(err);
    });
  }
}