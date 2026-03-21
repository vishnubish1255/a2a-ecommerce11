import type { uint64 } from "@algorandfoundation/algorand-typescript";
import {
  abimethod,
  Account,
  assert,
  assertMatch,
  Contract,
  Global,
  GlobalState,
  itxn,
  Txn,
  Uint64,
} from "@algorandfoundation/algorand-typescript";

/**
 * A2AEscrow - Escrow-based payment contract for agent-to-agent commerce.
 *
 * Flow:
 *  1. Creator deploys the contract
 *  2. Buyer calls `setupEscrow` to set seller + amount
 *  3. Buyer sends a payment group txn to fund the contract, then calls `fund`
 *  4. Buyer calls `release` to pay the seller via inner txn
 *  5. Or buyer calls `refund` to reclaim funds via inner txn
 *  6. Creator calls `deleteApplication` to clean up
 *
 * Based on canonical patterns from:
 * - algorandfoundation/puya-ts/examples/auction
 * - algorandfoundation/devportal-code-examples/InnerTransactions
 */
export class A2AEscrow extends Contract {
  buyer = GlobalState<Account>();
  seller = GlobalState<Account>();
  escrowAmount = GlobalState<uint64>({ initialValue: Uint64(0) });
  status = GlobalState<uint64>({ initialValue: Uint64(0) });

  @abimethod({ allowActions: "NoOp", onCreate: "require" })
  public createApplication(): void {
    this.buyer.value = Txn.sender;
    this.seller.value = Account();
    this.escrowAmount.value = Uint64(0);
    this.status.value = Uint64(0);
  }

  public setupEscrow(sellerAccount: Account, amount: uint64): void {
    assertMatch(Txn, { sender: this.buyer.value });
    assert(this.status.value === Uint64(0), "Escrow already set up");

    this.seller.value = sellerAccount;
    this.escrowAmount.value = amount;
  }

  public fund(): void {
    assertMatch(Txn, { sender: this.buyer.value });
    assert(this.status.value === Uint64(0), "Escrow not in setup state");
    assert(this.seller.value !== Account(), "Seller not set");

    const appBalance = Global.currentApplicationAddress.balance;
    assert(
      appBalance >= this.escrowAmount.value,
      "App not funded with enough ALGO"
    );

    this.status.value = Uint64(1);
  }

  public release(): void {
    assertMatch(Txn, { sender: this.buyer.value });
    assert(this.status.value === Uint64(1), "Escrow not funded");

    itxn
      .payment({
        receiver: this.seller.value,
        amount: this.escrowAmount.value,
        fee: 0,
      })
      .submit();

    this.status.value = Uint64(2);
  }

  public refund(): void {
    assertMatch(Txn, { sender: this.buyer.value });
    assert(this.status.value === Uint64(1), "Escrow not funded");

    itxn
      .payment({
        receiver: this.buyer.value,
        amount: this.escrowAmount.value,
        fee: 0,
      })
      .submit();

    this.status.value = Uint64(3);
  }

  @abimethod({ allowActions: "DeleteApplication" })
  public deleteApplication(): void {
    assertMatch(Txn, { sender: this.buyer.value });

    itxn
      .payment({
        receiver: this.buyer.value,
        closeRemainderTo: this.buyer.value,
        amount: 0,
      })
      .submit();
  }
}
