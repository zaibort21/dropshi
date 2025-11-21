// Simple carousel initializer for product pages (standalone, lightweight)
(function(){
  function initProductCarousels(){
    document.querySelectorAll('.product-carousel').forEach(car => {
      const track = car.querySelector('.carousel-track');
      if (!track) return;
      const slides = Array.from(track.children);
      let idx = 0;

      function go(i){
        idx = (i + slides.length) % slides.length;
        const offset = -idx * 100;
        track.style.transform = `translateX(${offset}%)`;
        // indicators
        const inds = car.querySelectorAll('.carousel-indicators button');
        inds.forEach((b,bi)=> b.classList.toggle('active', bi===idx));
      }

      // prev/next
      const prev = car.querySelector('.carousel-btn.prev');
      const next = car.querySelector('.carousel-btn.next');
      prev && prev.addEventListener('click', ()=> go(idx-1));
      next && next.addEventListener('click', ()=> go(idx+1));

      // indicators
      const indsContainer = car.querySelector('.carousel-indicators');
      if (indsContainer){
        slides.forEach((_,i)=>{
          const btn = document.createElement('button');
          btn.addEventListener('click', ()=> go(i));
          if (i===0) btn.classList.add('active');
          indsContainer.appendChild(btn);
        });
      }

      // autoplay (gentle)
      let autoplay = setInterval(()=> go(idx+1), 4500);
      car.addEventListener('mouseenter', ()=>{ clearInterval(autoplay); autoplay = null; });
      car.addEventListener('mouseleave', ()=>{ if (!autoplay) autoplay = setInterval(()=> go(idx+1), 4500); });

      // thumbnail clicks (if thumbs exist)
      const thumbs = car.closest('.gallery')?.querySelectorAll('.thumb');
      if (thumbs && thumbs.length){
        thumbs.forEach((t,ti)=> t.addEventListener('click', (e)=>{ go(ti); thumbs.forEach(x=>x.classList.remove('active')); t.classList.add('active'); }));
      }

      // initial set
      go(0);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProductCarousels);
  else initProductCarousels();
})();
