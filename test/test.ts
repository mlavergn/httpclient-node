import * as nodecrypto from 'crypto';

enum TestResult {
  pass = 'PASS:',
  fail = 'FAIL:',
}

enum RxEvent {
  create = 'CREATE',
  progress = 'PROGRESS',
  next = 'NEXT',
  error = 'ERROR',
  complete = 'COMPLETE',
}

class TestGroup {
  groups: { [name: string]: { [event: string]: string } } = {};

  public record(name: string, event: string): void {
    if (!this.groups[name]) {
      this.groups[name] = {};
    }
    this.groups[name][event] = event;
  }

  rxreport() {
    Object.keys(this.groups).forEach(
      (name) => {
        const events = this.groups[name];
        if (events[RxEvent.create] && events[RxEvent.next] && events[RxEvent.complete]) {
          Test.pass('Rx lifecycle', name);
        } else {
          Test.fail('Rx lifecycle', name);
        }
      }
    );
  }
}

/**
 * Simple test reporting
 */
export class Test {
  static groups: TestGroup = new TestGroup();

  static isTrue(name: string, test: boolean, ...addtl: string[]): void {
    console.log(test ? TestResult.pass : TestResult.fail, name, addtl.join(' '));
  }

  static isFalse(name: string, test: boolean, ...addtl: string[]): void {
    Test.isTrue(name, !test, ...addtl);
  }

  static isMd5(name: string, buffer: Buffer, expectedHash: string, ...addtl: string[]) {
    const hash = nodecrypto.createHash('md5').update(buffer).digest('hex');
    Test.isTrue(name, hash === expectedHash, ...addtl);
  }

  static pass(name: string, ...addtl: string[]): void {
    Test.isTrue(name, true, ...addtl);
  }

  static fail(name: string, ...addtl: string[]): void {
    Test.isTrue(name, false, ...addtl);
  }

  // RxJS

  static rxcreate(name: string): void {
    this.groups.record(name, RxEvent.create);
  }

  static rxprogress(name: string): void {
    this.groups.record(name, RxEvent.progress);
  }

  static rxnext(name: string): void {
    this.groups.record(name, RxEvent.next);
  }

  static rxerror(name: string, error: string): void {
    this.groups.record(name, RxEvent.error);
    Test.fail(name, RxEvent.error, error);
  }

  static rxcomplete(name: string): void {
    this.groups.record(name, RxEvent.complete);
  }
}
