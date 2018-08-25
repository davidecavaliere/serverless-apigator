// tslint:disable:no-expression-statement no-object-mutation

import test from 'ava';
import { ServerlessApigator } from './serverless-apigator';
import { boostrap, Endpoint, EndpointOptions, Lambda, LambdaOptions } from '@microgamma/apigator';
import * as Sinon from 'sinon';
import { getDebugger } from '@microgamma/ts-debug';

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

}


test.beforeEach((t) => {
  myModule = boostrap(TestClass, '');

  plugin = new ServerlessApigator(serverless, { stage: 'test' });

  Sinon.stub(plugin, 'importModule').callsFake(async () => {
    return { default: myModule };

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
        cors: true
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
          cors: true
        }
      }]
    })

  }).catch((err) => {
    console.log(err);
  });
});


// test('')