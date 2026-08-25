export type NewsSentimentLabel = 'positive' | 'neutral' | 'negative';
export interface NewsSentiment { label: NewsSentimentLabel; score: number; confidence: 'low' | 'medium' | 'high'; }

const POSITIVE = ['beat','beats','beating','growth','grew','profit','profits','surge','surged','rally','rallied','upgrade','upgraded','strong','record','outperform','outperformed','gain','gains','positive','bullish','recovery','recover'];
const NEGATIVE = ['miss','missed','decline','declined','loss','losses','fall','fell','drop','dropped','downgrade','downgraded','weak','warning','lawsuit','fraud','negative','bearish','cut','cuts','layoff','layoffs','default','crisis'];

function count(text:string, terms:string[]):number { const normalized=text.toLowerCase(); return terms.reduce((total, term)=>total + (normalized.match(new RegExp(`\\b${term}\\b`, 'g'))?.length ?? 0), 0); }

export function classifyNewsSentiment(title:string, description=''):NewsSentiment {
 const text=`${title} ${description}`.trim(); const positive=count(text,POSITIVE); const negative=count(text,NEGATIVE); const total=positive+negative;
 if(total===0) return {label:'neutral',score:0,confidence:'low'};
 const score=Math.max(-1,Math.min(1,(positive-negative)/total));
 const confidence=total>=4?'high':total>=2?'medium':'low';
 const label=score>0.2?'positive':score<-0.2?'negative':'neutral';
 return {label,score:Number(score.toFixed(2)),confidence};
}