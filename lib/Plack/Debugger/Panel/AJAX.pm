package Plack::Debugger::Panel::AJAX;

use strict;
use warnings;

use Config;

use parent 'Plack::Debugger::Panel';

sub new {
    my $class = shift;
    my %args  = @_ == 1 && ref $_[0] eq 'HASH' ? %{ $_[0] } : @_;

    $args{'title'} ||= 'AJAX Requests';

    $args{'after'} = sub {
        (shift)->set_result('... no AJAX results yet');
    };

    my $self = $class->SUPER::new( \%args );

    $self->add_metadata( track_subrequests => 1 );

    $self;
}

1;

__END__