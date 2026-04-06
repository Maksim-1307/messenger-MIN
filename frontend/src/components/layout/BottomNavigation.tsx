import { useEffect, useState, useRef } from 'react';
import styles from './BottomNavigation.module.scss';
import { Icon } from '@iconify/react';
import { Link, useLocation } from 'react-router-dom';

interface BottomNavigationItem {
    icon: string;
    path: string;
    label: string;
}

interface BottomNavigationProps {
    items: BottomNavigationItem[];
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ items }) => {

    const currentPath = useLocation().pathname;
    const [currentItemNum, setCurrentItemNum] = useState(1);
    const [isOpen, setIsOpen] = useState(false);
    const currentItemRef = useRef<HTMLAnchorElement | null>(null);
    const bgEffectRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        console.log(currentPath);
        const currentItem = items?.findIndex(item => item.path === currentPath);
        if (currentItem !== -1) {
            setCurrentItemNum(currentItem);
        } else {
            setCurrentItemNum(1);
        }
    }, [currentPath]);

    useEffect(() => {
        let shouldOpen = false;
        items.forEach(item => {
            if (item.path === currentPath) {
                shouldOpen = true;
            }
        });
        setIsOpen(shouldOpen);
    }, [currentPath]);

    useEffect(() => {
        if (currentItemRef.current && bgEffectRef.current) {
            const { offsetLeft, offsetTop, offsetWidth } = currentItemRef.current;
            const finalOffsetLeft = offsetLeft - offsetWidth / 2 + 18;
            const finalOffsetTop = offsetTop - 25;
            console.log('top offset', finalOffsetTop);
            bgEffectRef.current.style.transform = `translate(${finalOffsetLeft}px, ${finalOffsetTop}px)`;
        }
    }, [currentItemNum]);

    const getItems = () => {
        return items.map((item, index) => {
            const isActive = index === currentItemNum;
            const className = isActive ? 
                `${styles['bottom-navigation__item']} ${styles['bottom-navigation__item--active']}` : 
                `${styles['bottom-navigation__item']}`;
            return (
                <Link to={item.path} className={className} key={index} ref={index === currentItemNum ? currentItemRef : undefined}>
                    <Icon className={styles['bottom-navigation__item-icon']} icon={item.icon} />
                    <span>{item.label}</span>
                </Link>
            );
        });
    };

    if (isOpen) return (
        <div className={styles['bottom-navigation']}>
            <div className={styles['bottom-navigation__wrapper']}>
                <div className={styles['bottom-navigation__items']}>
                    {/* <div className={styles['bottom-navigation__item']}>
                        <Icon className={styles['bottom-navigation__item-icon']} icon="fluent:settings-32-regular" />
                        <span>Settings</span>
                    </div>
                    <div className={styles['bottom-navigation__item']}>
                        <Icon className={styles['bottom-navigation__item-icon']} icon="ph:chats-circle" />
                        <span>Chats</span>
                    </div>
                    <div className={styles['bottom-navigation__item']}>
                        <Icon className={styles['bottom-navigation__item-icon']} icon="ph:user-circle" />
                        <span>Profile</span>
                    </div> */}
                    {getItems()}
                </div>
                <div className={styles['bottom-navigation__background']}></div>
                <div className={styles['bottom-navigation__bg-effect']} ref={bgEffectRef}></div>
            </div>
        </div>
    );
};