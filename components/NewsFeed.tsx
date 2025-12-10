
import React, { useEffect, useState } from 'react';
import { fetchNewsFeed, NewsItem } from '../services/rssService';

const NewsFeed: React.FC = () => {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadNews = async () => {
      const items = await fetchNewsFeed();
      setNews(items);
      setLoading(false);
    };
    loadNews();
  }, []);

  if (loading) return null; // Don't show anything while loading to prevent layout shift jumping
  if (news.length === 0) return null;

  return (
    <section className="mb-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-4 px-4 md:px-0">
        <div className="h-8 w-1 bg-[#d00018]"></div>
        <h3 className="text-2xl font-bold brand-font uppercase text-gray-800">
          NPO Radio 2 <span className="text-[#d00018]">Nieuws</span>  <span className="italic text-gray-800"> #TOP2000</span>
        </h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 md:px-0">
        {news.map((item, idx) => (
          <a 
            key={idx} 
            href={item.link} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden border border-gray-100 flex flex-col h-full hover:-translate-y-1"
          >
            <div className="relative h-48 bg-gray-200 overflow-hidden">
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                   <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                </div>
              )}
              <div className="absolute top-0 right-0 bg-[#d00018] text-white text-xs font-bold px-2 py-1 m-2 rounded uppercase">
                Nieuws
              </div>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <span className="text-xs text-gray-400 font-mono mb-2 block">{item.pubDate}</span>
              <h4 className="font-bold text-lg leading-tight text-gray-900 group-hover:text-[#d00018] transition-colors mb-2 brand-font">
                {item.title}
              </h4>
              <p className="text-gray-600 text-sm line-clamp-3 flex-1">
                {item.description}
              </p>
              <div className="mt-4 flex items-center text-[#d00018] font-bold text-xs uppercase tracking-wider group-hover:underline">
                Lees Meer 
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
              </div>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};

export default NewsFeed;
