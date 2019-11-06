import { Test } from './test';

import { HttpClient, HttpClientOptionsProtocol, HttpClientResponse } from '../httpclient';

import { Transform } from 'stream';

import { Subscriber } from 'rxjs/Subscriber';
import { interval } from 'rxjs/observable/interval';
import 'rxjs/add/operator/take';

export class HttpClientTests {
  /**
   * Run the testcases
   */
  public static run(): void {
    const tests = new HttpClientTests();
    tests.testGetHTTPS();
    tests.testPostHTTPS();
    tests.testBlob();
    tests.testStreamBlob();
    tests.testStream();
    // wait before running the Rx lifecyle report
    interval(2000).take(1).subscribe(
      () => {
        Test.groups.rxreport();
      }
    );
  }

  /**
   * GET
   */
  public testGetHTTPS(): void {
    Test.rxcreate('HttpClient::testGetHTTPS');
    const options: HttpClientOptionsProtocol = {
      headers: {},
      responseType: 'text',
    };
    const http$ = HttpClient.get('https://httpbin.org', options);
    http$.subscribe(
      (response: HttpClientResponse) => {
        Test.rxnext('HttpClient::testGetHTTPS');
        Test.isTrue('HttpClient::testGetHTTPS status', response.statusCode === 200);
        Test.isTrue('HttpClient::testGetHTTPS read', response.body.length > 10);
      },
      (error) => {
        Test.rxerror('HttpClient::testGetHTTPS', error);
      },
      () => {
        Test.rxcomplete('HttpClient::testGetHTTPS');
      }
    );
  }

  /**
   * POST
   */
  public testPostHTTPS(): void {
    Test.rxcreate('HttpClient::testPostHTTPS');
    const options: HttpClientOptionsProtocol = {
      headers: {},
      responseType: 'text',
    };
    const http$ = HttpClient.post('https://httpbin.org/post', {foo: 1}, options);
    http$.subscribe(
      (response: HttpClientResponse) => {
        Test.rxnext('HttpClient::testPostHTTPS');
        Test.isTrue('HttpClient::testPostHTTPS status', response.statusCode === 200);
        Test.isTrue('HttpClient::testPostHTTPS read', response.body.length > 10);
      },
      (error) => {
        Test.rxerror('HttpClient::testPostHTTPS', error);
      },
      () => {
        Test.rxcomplete('HttpClient::testPostHTTPS');
      }
    );
  }

  /**
   * POST
   */
  public testBlob(): void {
    Test.rxcreate('HttpClient::testBlob');
    const options: HttpClientOptionsProtocol = {
      headers: {},
      responseType: 'blob',
    };
    const http$ = HttpClient.get('https://upload.wikimedia.org/wikipedia/en/4/4e/Steamboat-willie.jpg', options);
    http$.subscribe(
      (response: Buffer) => {
        Test.rxnext('HttpClient::testBlob');
        Test.isMd5('HttpClient::testBlob read', response, 'ec5997c748d28d59941ccb3c51462e29');
      },
      (error) => {
        Test.rxerror('HttpClient::testBlob', error);
      },
      () => {
        Test.rxcomplete('HttpClient::testBlob');
      }
    );
  }

  /**
   * Stream BLOB
   */
  public testStreamBlob(): void {
    Test.rxcreate('HttpClient::testStreamBlob');
    const options: HttpClientOptionsProtocol = {
      responseType: 'stream',
      headers: {
      },
      reportProgress: true,
    };
    const http$ = HttpClient.get('http://127.0.0.1:8000/static/banksy.jpg', options);
    http$.subscribe(
      (response: HttpClientResponse) => {
        Test.rxnext('HttpClient::testStreamBlob');
        Test.isTrue('HttpClient::testStreamBlob status', response.statusCode === 200);
        (<Transform>response.body).on('data', (data: Buffer) => {
          Test.isTrue('HttpClient::testStreamBlob read', data.byteLength > 0);
        });
      },
      (error) => {
        Test.rxerror('HttpClient::testStreamBlob', error);
      },
      () => {
        Test.rxcomplete('HttpClient::testStreamBlob');
      }
    );
  }

  /**
   * Stream
   */
  public testStream(): void {
    Test.rxcreate('HttpClient::testStream');
    const reqStream = new Transform({
      transform(chunk, encoding, callback) {
        this.push(chunk);
        callback();
      }
    });

    const options: HttpClient = {
      headers: {
        'Content-Type': 'binary/octet-stream'
      },
      responseType: 'stream',
    };
    const http$ = HttpClient.post('http://127.0.0.1:8000/json', reqStream, options);
    reqStream.write(
      JSON.stringify(
        {
          method: 'GET',
          status: 200,
          details: 'The quick brown fox jumped over the lazy dog.'
        }
      )
    );
    reqStream.end();

    http$.subscribe(
      (response: HttpClientResponse) => {
        Test.rxnext('HttpClient::testStream');
        Test.isTrue('HttpClient::testStream status', response.statusCode === 200);
        (<Transform>response.body).on('data', (data: Buffer) => {
          Test.isTrue('HttpClient::testStream read', data.byteLength > 10);
        });
      },
      (error) => {
        Test.rxerror('HttpClient::testStream', error);
      },
      () => {
        Test.rxcomplete('HttpClient::testStream');
      }
    );
  }
}

HttpClientTests.run();
