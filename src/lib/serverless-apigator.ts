import { getEndpointMetadata, getLambdaMetadata, EndpointOptions, LambdaOptions } from '@microgamma/apigator';
import { getDebugger } from '@microgamma/ts-debug';


const debug = getDebugger('microgamma:serveless-apigator');

export class ServerlessApigator {

  public hooks: any = {
    'before:package:initialize': () => {
      debug('before:package:initialize');
      return this.configureFunctions();
    },

    'before:invoke:local:invoke': () => {
      debug('before:invoke:local:invoke');
      return this.configureFunctions();
    },

    // adding hook to make it work with serverless-offline plugin
    'offline:start:init': () => {
      debug('offline:init');
      return this.configureFunctions();
    }
  };

  private servicePath: string;
  private entrypoint: string;
  private serviceName: string;

  constructor(private serverless: any, private options: any = {}) {

    this.options = options;

    this.servicePath = serverless.config.servicePath;
    debug('servicePath:', this.servicePath);

    const awsService = serverless.service.service;
    this.serviceName = awsService;
    debug('awsService name', awsService);
    debug('stage', this.options.stage);

    if (!serverless.service.custom.entrypoint) {
      throw new Error('you shall provide path to your entrypoint');
    }

    this.entrypoint = serverless.service.custom.entrypoint;
    debug('entrypoint', this.entrypoint);

  }

  public async configureFunctions() {

    debug('importing module');

    const modulePath = `${this.servicePath}/${this.entrypoint}`;

    const module = await this.importModule(modulePath);

    this.serverless.cli.log('Injecting configuration');
    debug('works', module);

    const endpoint = module.default;

    debug('Endpoints', getLambdaMetadata(endpoint));

    const endpointMetadata: EndpointOptions = getEndpointMetadata(endpoint);
    debug('Endpoint', endpointMetadata);

    const lambdas = getLambdaMetadata(endpoint);

    this.serverless.cli.log('Parsing Apigator Service definitions');

    for (const lambda of lambdas) {
      debug('configuring lambda', lambda);

      this.addFunctionToService(endpointMetadata, lambda);

      debug('functions are');
      debug(this.serverless.service.functions[lambda.name]);
      debug(this.serverless.service.functions[lambda.name].events);
    }

    this.serverless.cli.log(`${lambdas.length} functions configured`);
  }


  public async importModule(path: string) {
    return import(path);
  }

  public addFunctionToService(endpoint: EndpointOptions, lambda: LambdaOptions) {
    const functionName = lambda.name;

    const basePath = endpoint.basePath || '';

    this.serverless.service.functions[lambda.name] = {
      name: `${this.serviceName}-${this.options.stage || ''}-${functionName}`,
      handler: `${this.entrypoint}.${functionName}`,
      events: [
        {
          http:  {
            path: basePath + lambda.path,
            method: lambda.method,
            integration: 'lambda',
            cors: !!lambda.cors,
            private: !!lambda.private
          }
        }
      ]
    };

  }

}