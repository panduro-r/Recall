// Connection only. Deliberately has no signing, payment or network-switch API.
const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value)?value:null;

export class WalletConnection {
  constructor(onChange=()=>{}) {
    this.onChange=onChange;this.account=null;this.provider=null;this.busy=false;
    this.version=0;this.listeners=[];
  }
  detach() {
    for(const [event,handler] of this.listeners)this.provider?.removeListener?.(event,handler);
    this.listeners=[];
  }
  disconnect() {
    this.version++;this.detach();this.provider=null;this.account=null;this.busy=false;this.onChange();
  }
  async connect(provider) {
    if(this.busy)return false;
    if(typeof provider?.request!=='function')throw Error('No wallet is available.');
    this.disconnect();this.provider=provider;this.busy=true;
    const version=this.version;
    this.onChange();
    try {
      const accounts=await provider.request({method:'eth_requestAccounts'});
      if(version!==this.version)return false;
      const account=Array.isArray(accounts)?address(accounts[0]):null;
      if(!account)throw Error('No account was selected. Open your wallet and try again.');
      this.account=account;
      const accountsChanged=accounts=>{
        if(version!==this.version)return;
        const next=Array.isArray(accounts)?address(accounts[0]):null;
        if(!next){this.disconnect();return;}
        this.account=next;this.onChange();
      };
      const disconnected=()=>{if(version===this.version)this.disconnect();};
      if(typeof provider.on==='function') {
        this.listeners=[['accountsChanged',accountsChanged],['disconnect',disconnected]];
        for(const [event,handler] of this.listeners)provider.on(event,handler);
      }
      return true;
    } catch(error) {
      if(version!==this.version)return false;
      this.disconnect();
      if(error?.code===4001)throw Error('Connection cancelled. You can keep comparing without a wallet.');
      if(error?.code===-32002)throw Error('A connection request is already open. Check your wallet extension.');
      throw Error('Could not connect. Unlock your wallet, select an account and try again.');
    } finally {
      if(version===this.version){this.busy=false;this.onChange();}
    }
  }
}
