import { getAuthorizerMetadata, getEndpointMetadata, getLambdaMetadata, EndpointOptions, LambdaOptions } from '@microgamma/apigator';
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

    const authorizerFn = getAuthorizerMetadata(endpoint);
    debug('auth function found', authorizerFn);

    this.serverless.cli.log('Parsing Apigator Service definitions');

    this.addFunctionToService(endpointMetadata, authorizerFn);

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

    const fullFunctionName = `${this.serviceName}-${this.options.stage || ''}-${functionName}`;

    // cors true by default
    let corsOption = true;

    if (lambda.hasOwnProperty('cors')) {
      corsOption = lambda.cors;
    } else if (endpoint.hasOwnProperty('cors')) {
      corsOption = endpoint.cors;
    }

    const privateLambda = lambda.hasOwnProperty('private') ? !!lambda.private: !!endpoint.private;

    const path = basePath + lambda.path;
    const method = lambda.method;
    const authorizer = lambda.hasOwnProperty('authorizer') ? lambda.authorizer : null;

    const httpEvent: LambdaOptions & { integration: string } = {
      integration: 'lambda',
      cors: corsOption,
      private: privateLambda
    };

    if (lambda.path) {
      httpEvent.path = path;
    }

    if (method) {
      httpEvent.method = method;
    }

    if (authorizer) {
      httpEvent.authorizer = authorizer;
    }

    const lambdaDef = {
      name: fullFunctionName,
      handler: `${this.entrypoint}.${functionName}`
    };

    if (lambda.path) {
      lambdaDef['events'] = [{
        http:  httpEvent
      }]
    }

    this.serverless.service.functions[lambda.name] = lambdaDef;

    debug('function configured', this.serverless.service.functions[lambda.name]);

  }

}