//
// Node imports
//
import { request as HTTP, ClientRequest, RequestOptions, IncomingMessage } from 'http';
import { request as HTTPS } from 'https';
import { parse as URLParse } from 'url';
import { Transform } from 'stream';

import { Subject } from 'rxjs/Subject';
import { Observable } from 'rxjs/Observable';

/**
 * Angular compatible HttpClient interfaces
 */

export enum HttpClientObserveType {
  body = 'body',
  events = 'events',
  response = 'response',
}

export enum HttpClientResponseType {
  arraybuffer = 'arraybuffer',
  blob = 'blob',
  document = 'document',
  json = 'json',
  text = 'text',
  stream = 'stream',
}

export interface HttpClientOptionsProtocol {
  headers?: { [header: string]: string | string[] };
  observe?: HttpClientObserveType | any;
  params?: { [param: string]: string | string[] };
  reportProgress?: boolean;
  responseType?: HttpClientResponseType | any;
  withCredentials?: boolean;
  body?: any;
  timeout?: number;
}

export interface HttpClientResponseProtocol {
  body: string | { [key: string]: any } | any;
  statusCode: number;
  statusText: string;
  headers: { [key: string]: string | string[] };
  type: number;
  partialText: string;
  chunks: Buffer[];
}

export interface HttpClientProtocol {
  // tslint:disable-next-line: rxjs-finnish
  get<T = HttpClientResponseProtocol>(url: string, options: HttpClientOptionsProtocol): Observable<T>;
  // tslint:disable-next-line: rxjs-finnish
  post<T = HttpClientResponseProtocol>(url: string, body: string | object | null, options: HttpClientOptionsProtocol): Observable<T>;
}

/**
 * Enum for NodeJS http/https request events
 */
enum NodeRequestEvent {
  data = 'data',
  timeout = 'timeout',
  error = 'error',
  end = 'end',
}

/**
 * Enum for NodeJS request protocols
 */
enum NodeRequestProtocol {
  http = 'http:',
  https = 'https:',
}

/**
 * Enum for NodeJS request methods
 */
enum NodeRequestMethod {
  get = 'get',
  post = 'post',
}

/**
 * Enum for NodeJS request methods
 */
enum NodeResponseReadyState {
  UNSENT = 0,
  OPENED = 1,
  HEADERS = 2,
  LOADING = 3,
  DONE = 4
}

/**
 * Mimic Angular HttpClientResponse
 */
export class HttpClientResponse implements HttpClientResponseProtocol {
  body: string | { [key: string]: any } | any = '';
  statusCode = 200;
  statusText = 'OK';
  headers: { [key: string]: string | string[] } = {};
  type: NodeResponseReadyState = NodeResponseReadyState.UNSENT;
  partialText = '';
  chunks: Buffer[] = [];

  public constructor(response?: HttpClientResponseProtocol) {
    if (response) {
      this.statusCode = response.statusCode;
      this.statusText = response.statusText;
      this.headers = response.headers;
    }
  }

  public setBody(body: string): void {
    let payload: { [key: string]: any } | string = body;
    // convert to JSON if the content-type specifies
    if (this.statusCode === 200) {
      if (this.headers['content-type'] === 'application/json') {
        try {
          payload = <{ [key: string]: any }>JSON.parse(body);
        } catch (error) {
        }
      }
    }

    this.body = payload;
  }
}

/**
 * Implements an Angular compatible HttpClient for Node
 */
export class HttpClient {
  // tslint:disable-next-line: rxjs-finnish
  public static get<T = HttpClientResponseProtocol>(url: string, options: HttpClientOptionsProtocol):
    Observable<T> {
    const httpOptions: HttpClientOptionsProtocol = options ? options : { responseType: HttpClientResponseType.arraybuffer };
    return HttpClient.request$<T>(NodeRequestMethod.get, url, undefined, httpOptions);
  }

  // tslint:disable-next-line: rxjs-finnish
  public static post<T = HttpClientResponseProtocol>(url: string, body: string | object | null, options: HttpClientOptionsProtocol):
    Observable<T> {
    const httpOptions: HttpClientOptionsProtocol = options ? options : { responseType: HttpClientResponseType.arraybuffer };
    return HttpClient.request$<T>(NodeRequestMethod.post, url, body, httpOptions);
  }

  private static request$<T>(method: NodeRequestMethod, url: string, body: any, options: HttpClientOptionsProtocol):
    Observable<T> {
    const nodeOptions: RequestOptions = URLParse(url);
    nodeOptions.method = method;

    // map options
    nodeOptions.headers = options.headers ? options.headers : {};
    nodeOptions.timeout = options.timeout ? options.timeout : 0;
    // @ts-ignore
    nodeOptions.rejectUnauthorized = false;

    // setup the observable and client
    const observer$: Subject<any> = new Subject<T>();
    const client = (nodeOptions.protocol === NodeRequestProtocol.http) ? HTTP : HTTPS;

    // perform the request
    try {
      const nodeRequest: ClientRequest = client(nodeOptions, (nodeResponse: IncomingMessage) => {
        const clientResponse = new HttpClientResponse();
        clientResponse.statusCode = nodeResponse.statusCode ? nodeResponse.statusCode : 501;
        clientResponse.statusText = nodeResponse.statusMessage ? nodeResponse.statusMessage : '';

        let responseBuffer = Buffer.allocUnsafe(0);
        let responseStream: Transform;

        // stream response
        if (options.responseType === HttpClientResponseType.stream) {
          responseStream = new Transform({
            transform(chunk, encoding, callback) {
              responseStream.push(chunk);
              callback();
            }
          });
          clientResponse.body = responseStream;
        }

        // request events
        nodeRequest.on(NodeRequestEvent.error, (error) => {
          observer$.error(clientResponse);
        });

        nodeRequest.on(NodeRequestEvent.timeout, () => {
          observer$.error(clientResponse);
          nodeRequest.abort();
        });

        // response events
        nodeResponse.on(NodeRequestEvent.data, (chunk: Buffer) => {
          if (options.responseType !== HttpClientResponseType.stream) {
            responseBuffer = Buffer.concat([responseBuffer, chunk]);
            if (options.reportProgress) {
              clientResponse.partialText = responseBuffer.toString();
              observer$.next(clientResponse);
            }
          } else {
            responseStream.write(chunk);
            observer$.next(clientResponse);
            // NOTE: using pipe instead of write results in
            // the handler closing the response on EOF breaking
            // event handling
            // nodeResponse.pipe(this.response, { end: false });
          }
        });

        nodeResponse.on(NodeRequestEvent.end, () => {
          switch (options.responseType) {
            case HttpClientResponseType.json:
              const responseText = responseBuffer.toString();
              clientResponse.body = <Object>JSON.parse(responseText);
              break;
            case HttpClientResponseType.arraybuffer:
            case HttpClientResponseType.blob:
              observer$.next(responseBuffer);
              break;
            case HttpClientResponseType.document:
            case HttpClientResponseType.text:
              clientResponse.body = responseBuffer.toString();
              observer$.next(clientResponse);
              break;
            default:
              observer$.next(clientResponse);
          }

          observer$.complete();
        });
      });

      if (body) {
        if (body instanceof Transform) {
          body.pipe(nodeRequest);
          return observer$;
        } else if (body instanceof ArrayBuffer) {
          nodeRequest.write(body);
        } else if (typeof body === 'object') {
          nodeRequest.write(JSON.stringify(body));
        } else {
          nodeRequest.write(String(body));
        }
      }

      nodeRequest.end();
    } catch (exception) {
      observer$.error(String(exception));
    }

    return observer$;
  }
}
