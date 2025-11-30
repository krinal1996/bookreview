import React, {useEffect, useState} from 'react';

export default function App(){
  const [books, setBooks] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(()=>{
    fetch('/api/books')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setBooks)
      .catch(e => setErr(String(e)));
  }, []);

  if (err) return <div style={{padding:20}}>Error: {err}</div>;
  if (!books) return <div style={{padding:20}}>Loading...</div>;

  return (
    <div style={{fontFamily:'Arial', padding:20}}>
      <h1>BookReview</h1>
      {books.map(b=>(
        <div key={b._id} style={{border:'1px solid #ddd', padding:12, margin:6}}>
          <h3>{b.title} — {b.author}</h3>
          <p>{b.desc}</p>
          <h4>Reviews</h4>
          {b.reviews?.length ? b.reviews.map((r,i)=>(<div key={i}><b>{r.author}:</b> {r.text}</div>)) : <i>No reviews</i>}
        </div>
      ))}
    </div>
  );
}
