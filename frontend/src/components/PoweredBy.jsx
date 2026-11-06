import './PoweredBy.css';
export default function PoweredBy({className=''}){
 return <div className={'powered-brand '+className} aria-label="Powered by Go Conectivo"><span className="powered-mark"><img src="/brand/go-conectivo.png" alt="" /></span><span className="powered-wordmark"><span className="powered-caption">Powered by</span><span className="powered-name">Go <span>Conectivo</span></span></span></div>;
}
