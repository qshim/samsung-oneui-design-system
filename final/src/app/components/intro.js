export default function Intro (){
    return(
        {showIntro && (
            <div
              className={`bg-[#0f0f13] intro-overlay flex items-center justify-center fixed inset-0 z-[990] transition-opacity duration-1000 ${
                isFading ? "opacity-0 pointer-events-none" : "opacity-100"
              }`}
              onClick={handleIntroClick}
            >
              <Header width={400} height={400} className='bg-[#0f0f13]'/>
              {/*<Cover />*/}
            </div>
          )}
    );
}