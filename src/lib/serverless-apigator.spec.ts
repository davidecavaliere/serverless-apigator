// tslint:disable:no-expression-statement no-object-mutation

import test from 'ava';
import { ServerlessApigator } from './serverless-apigator';
import { Authorizer, bootstrap, Endpoint, EndpointOptions, Lambda, LambdaOptions } from '@microgamma/apigator';
import * as Sinon from 'sinon';

const d = console.log;

const serverless = {
  cli: {
    log: console.log
  },
  config: {
    servicePath: 'my-path',
  },
  service: {
    service: 'my-service',
    custom: {
      entrypoint: 'my-entrypoint'
    },
    functions: {}
  }
};

let plugin;

let myModule;


const options: EndpointOptions = {
  name: 'endpoint-name'
};

const option1: LambdaOptions = {
  method: 'get',
  name: 'lambda-name-1',
  path: '/'
};

@Endpoint(options)
class TestClass {
  @Lambda(option1)
  public findAll(arg1, arg2, arg3) {
    return arg1 + arg2 + arg3;
  }

  @Lambda({
    name: 'name'
  })
  public functionA(arg1, arg2, arg3) {
    return arg1 + arg2 + arg3;
  }

  @Authorizer()
  public authorizer() {
    return true;
  }

}


test.beforeEach((t) => {
  myModule = bootstrap(TestClass);

  plugin = new ServerlessApigator(serverless, { stage: 'test' });

  Sinon.stub(plugin, 'importModule').callsFake(async () => {
    return { default: TestClass };

  });
});

test('serverless-apigator', (t) => {
  t.is(plugin instanceof ServerlessApigator, true);
});

test('should set the servicePath', (t) => {
  t.deepEqual(plugin.servicePath, serverless.config.servicePath);
});

test('should set service name', (t) => {
  t.deepEqual(plugin.serviceName, serverless.service.service);
});

test('should set entrypoint path', (t) => {
  t.deepEqual(plugin.entrypoint, serverless.service.custom.entrypoint);
});

test('#addFunctionToService', (t) => {
  plugin.addFunctionToService({
    name: 'my-endpoint',
    basePath: 'root'
  }, {
    method: 'get',
    name: 'my-lambda',
    path: '/:id'
  });

  t.deepEqual(serverless.service.functions['my-lambda'], {
    name: 'my-service-test-my-lambda',
    handler: 'my-entrypoint.my-lambda',
    events: [{
      http: {
        path: 'root/:id',
        method: 'get',
        integration: 'lambda',
        cors: true,
        private: false
      }
    }]
  });
});

test('#configureFunctions', (t) => {
  t.plan(1);
  return plugin.configureFunctions().then(() => {

    d('here we have the functions');
    t.deepEqual(serverless.service.functions['lambda-name-1'], {
      name: 'my-service-test-lambda-name-1',
      handler: 'my-entrypoint.lambda-name-1',
      events: [{
        http: {
          path: '/',
          method: 'get',
          integration: 'lambda',
          cors: true,
          private: false
        }
      }]
    })

  }).catch((err) => {
    console.log(err);
  });
});

test('function with only name should have empty event array', (t) => {
  t.plan(1);
  return plugin.configureFunctions().then(() => {

    t.deepEqual(serverless.service.functions['name'], {
      name: 'my-service-test-name',
      handler: 'my-entrypoint.name',
      events: []
    })

  }).catch((err) => {
    console.log(err);
  });
});

test('authorizer function should be configured', (t) => {
  t.plan(1);
  return plugin.configureFunctions().then(() => {

    t.deepEqual(serverless.service.functions['authorizer'], {
      name: 'my-service-test-authorizer',
      handler: 'my-entrypoint.authorizer',
      events: []
    });

  }).catch((err) => {
    console.log(err);
  });
});
